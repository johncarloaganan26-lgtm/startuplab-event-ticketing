import supabase from '../database/db.js';
import { sendSmtpEmail } from '../utils/smtpMailer.js';
import { getAdminSmtpConfig } from '../utils/notificationService.js';
import crypto from 'crypto';
import path from 'path';

const STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'startuplab-business-ticketing';

// Helper to format messages for HTML emails (newlines to <br> and [IMAGE_URL] to <img>)
const formatEmailMessage = (msg = '') => {
  let formatted = String(msg || '').replace(/\n/g, '<br/>');
  // Replace [IMAGE_URL: url] with <img> tag
  formatted = formatted.replace(/\[IMAGE_URL: (.*?)\]/g, '<div style="margin-top: 20px;"><img src="$1" style="max-width: 100%; border-radius: 8px; border: 1px solid #E2E8F0;" alt="Attachment"/></div>');
  return formatted;
};

export const uploadSupportImage = async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'Image file is required' });
    if (!file.mimetype || !file.mimetype.startsWith('image/')) {
      return res.status(400).json({ error: 'Only image uploads are allowed' });
    }

    const ext = path.extname(file.originalname || '') || '.png';
    const fileName = `${crypto.randomUUID()}${ext}`;
    const filePath = `support-attachments/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        upsert: true,
      });

    if (uploadError) return res.status(500).json({ error: uploadError.message });

    const { data: publicData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(filePath);
    const publicUrl = publicData?.publicUrl;
    if (!publicUrl) return res.status(500).json({ error: 'Failed to generate public URL' });

    return res.json({ publicUrl, path: filePath });
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'Image upload failed' });
  }
};

export const submitSupportTicket = async (req, res) => {
  try {
    const { subject, message } = req.body;
    const userId = req.user?.id; // Standard auth id from authMiddleware

    if (!subject || !message) {
      return res.status(400).json({ error: 'Subject and message are required.' });
    }

    // 1. Get the organization of the user to know who sent this
    const { data: orgData } = await supabase
      .from('organizers')
      .select('"organizerId", "organizerName", brandColor')
      .eq('ownerUserId', userId)
      .maybeSingle();

    const fromOrgName = orgData?.organizerName || 'An Organizer';

    // 2. Find the Superadmin receiving this
    const { data: adminUser } = await supabase
      .from('users')
      .select('userId, email')
      .eq('role', 'ADMIN')
      .limit(1)
      .maybeSingle();

    if (!adminUser) {
      return res.status(503).json({ error: 'System administrator not found. Please try again later.' });
    }

    // 3. Create a ticket record using the notifications table to avoid schema issues
    const { data: ticket, error: ticketError } = await supabase
      .from('notifications')
      .insert({
        recipient_user_id: adminUser.userId,
        actor_user_id: userId,
        organizer_id: orgData?.organizerId || null,
        type: 'SUPPORT_TICKET',
        title: subject,
        message: message,
        metadata: {
          status: 'open',
          orgName: fromOrgName,
          orgId: orgData?.organizerId
        },
        is_read: false
      })
      .select('*')
      .single();

    if (ticketError) {
      console.error('[Support] DB Insert Error:', ticketError);
      return res.status(500).json({ error: 'Failed to create support ticket in system.' });
    }


    // 4. Send Real Time Email to the Admin!
    // We use the Admin's own SMTP settings to send TO themselves
    const adminSmtp = await getAdminSmtpConfig();
    try {
      if (adminSmtp) {
        const htmlBody = `
          <div style="font-family: 'Inter', sans-serif; background-color: #F8FAFC; padding: 60px 20px; color: #0F172A;">
            <div style="max-width: 520px; margin: 0 auto;">
              <div style="text-align: center; margin-bottom: 40px;">
                <img src="https://xmjdcbzgdfylbqkjoyyb.supabase.co/storage/v1/object/public/startuplab-business-ticketing/assets/assets/image%20(1).svg" height="80" alt="StartupLab Logo">
              </div>
              
              <div style="background-color: #FFFFFF; border-radius: 12px; border: 1px solid #E2E8F0; padding: 50px; shadow: 0 40px 80px rgba(46, 46, 47, 0.05);">
                <div style="margin-bottom: 30px;">
                  <span style="display: inline-block; padding: 8px 14px; background-color: #38BDF2; color: #FFFFFF; font-size: 10px; font-weight: 800; letter-spacing: 0.15em; text-transform: uppercase; border-radius: 10px;">SUPPORT REQUEST</span>
                </div>
                
                <h1 style="font-size: 32px; font-weight: 800; letter-spacing: -0.04em; line-height: 1.1; margin: 0 0 24px 0;">${subject}</h1>
                
                <div style="margin-bottom: 32px; padding: 20px; background-color: #F8FAFC; border-radius: 8px; border-left: 4px solid #38BDF2; font-size: 14px;">
                  <p style="margin: 0;"><strong>Organizer:</strong> ${fromOrgName}</p>
                  <p style="margin: 8px 0 0;"><strong>Sent By:</strong> ${req.user?.name || req.user?.email}</p>
                </div>

                <div style="font-size: 16px; line-height: 1.6; color: #475569;">
                  ${formatEmailMessage(message)}
                </div>
              </div>

              <div style="text-align: center; margin-top: 50px;">
                <p style="font-size: 11px; color: #94A3B8; line-height: 1.6;">
                  &copy; 2026 StartupLab Business Ticketing. All rights reserved.
                </p>
              </div>
            </div>
          </div>
        `;

        await sendSmtpEmail({
          to: adminUser.email,
          subject: `[Support Ticket] ${subject}`,
          text: message,
          html: htmlBody,
          replyTo: req.user?.email,
          from: `System Alert <${adminSmtp.fromAddress}>`,
          config: adminSmtp,
        });
      }
    } catch (emailErr) {
      console.error('[Support] Admin email failed:', emailErr);
    }

    // 5. Send Thank-you Email to the User!
    try {
      if (adminSmtp && req.user?.email) {
        const userHtml = `
          <div style="font-family: 'Inter', sans-serif; background-color: #F8FAFC; padding: 60px 20px; color: #0F172A;">
            <div style="max-width: 520px; margin: 0 auto;">
              <div style="text-align: center; margin-bottom: 40px;">
                <img src="https://xmjdcbzgdfylbqkjoyyb.supabase.co/storage/v1/object/public/startuplab-business-ticketing/assets/assets/image%20(1).svg" height="80" alt="StartupLab Logo">
              </div>
              
              <div style="background-color: #FFFFFF; border-radius: 12px; border: 1px solid #E2E8F0; padding: 50px; shadow: 0 40px 80px rgba(46, 46, 47, 0.05);">
                <div style="margin-bottom: 30px;">
                  <span style="display: inline-block; padding: 8px 14px; background-color: #38BDF2; color: #FFFFFF; font-size: 10px; font-weight: 800; letter-spacing: 0.15em; text-transform: uppercase; border-radius: 10px;">TICKET RECEIVED</span>
                </div>
                
                <h2 style="font-size: 24px; font-weight: 800; letter-spacing: -0.04em; line-height: 1.2; margin: 0 0 24px 0;">Hi ${req.user?.name || 'there'},</h2>
                <p style="font-size: 15px; line-height: 1.6; color: #475569; margin-bottom: 32px;">
                  We have received your support ticket <strong>"${subject}"</strong>. Our team is now reviewing your request and will get back to you shortly.
                </p>

                <div style="background-color: #F8FAFC; padding: 24px; border-radius: 12px; border: 1px solid #E2E8F0; font-size: 14px; color: #475569; font-style: italic;">
                  "${formatEmailMessage(message)}"
                </div>

                <div style="margin-top: 40px; text-align: center;">
                    <p style="font-size: 14px; font-weight: 700; color: #0F172A;">— StartupLab Support Team</p>
                </div>
              </div>

              <div style="text-align: center; margin-top: 50px;">
                <p style="font-size: 11px; color: #94A3B8; line-height: 1.6;">
                  &copy; 2026 StartupLab Business Ticketing. All rights reserved.
                </p>
              </div>
            </div>
          </div>
        `;

        await sendSmtpEmail({
          to: req.user.email,
          subject: 'We received your support ticket',
          text: `Hi ${req.user.name || 'there'},\n\nWe received your support ticket "${subject}". We will reply shortly.\n\n— StartupLab Support Team`,
          html: userHtml,
          from: `StartupLab Support <${adminSmtp.fromAddress}>`,
          config: adminSmtp,
        });
      }
    } catch (userEmailErr) {
      console.error('[Support] User thank-you email failed:', userEmailErr);
    }

    return res.status(200).json({ message: 'Support ticket submitted successfully.', ticket });
  } catch (error) {
    console.error('[Support] Error submitting ticket:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getAdminSupportTickets = async (req, res) => {
  try {
    const adminId = req.user?.id;

    // Fetch all notifications of type SUPPORT_TICKET meant for this admin
    const { data, error } = await supabase
      .from('notifications')
      .select('*, actor:users!actor_user_id(name, email), organizer:organizers!organizer_id("organizerId", "profileImageUrl", "organizerName")')
      .eq('type', 'SUPPORT_TICKET')
      .eq('recipient_user_id', adminId)
      .order('created_at', { ascending: false });

    if (error) {
       console.error('[Support] Fetch error:', error);
       return res.status(500).json({ error: 'Failed to load tickets.' });
    }

    res.json(data || []);
  } catch (error) {
    console.error('[Support] Load Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const resolveSupportTicket = async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user?.id;

    const { data, error } = await supabase
      .from('notifications')
      .update({
        metadata: { 
          ...((await supabase.from('notifications').select('metadata').eq('notification_id', id).single()).data?.metadata || {}),
          status: 'resolved' 
        },
        is_read: true,
        read_at: new Date().toISOString()
      })
      .eq('notification_id', id)
      .eq('recipient_user_id', adminId)
      .select('*')
      .single();

    if (error) {
       return res.status(500).json({ error: 'Failed to resolve ticket.' });
    }
    
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getMySupportTickets = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { data, error } = await supabase
      .from('notifications')
      .select(`
        *, 
        messages:support_messages(
          message_id, 
          message, 
          created_at, 
          is_admin_reply,
          sender:users!sender_user_id(name, imageUrl)
        )
      `)
      .eq('type', 'SUPPORT_TICKET')
      .eq('actor_user_id', userId)
      .eq('is_archived', false) // Only active
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    console.error('[Support] Load My Tickets Error:', err);
    res.status(500).json({ error: 'Failed to load support history' });
  }
};

export const getArchivedSupportTickets = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { data, error } = await supabase
      .from('notifications')
      .select(`
        *, 
        messages:support_messages(
          message_id, 
          message, 
          created_at, 
          is_admin_reply,
          sender:users!sender_user_id(name, imageUrl)
        )
      `)
      .eq('type', 'SUPPORT_TICKET')
      .eq('actor_user_id', userId)
      .eq('is_archived', true) // Only archived
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    console.error('[Support] Load Archived Tickets Error:', err);
    res.status(500).json({ error: 'Failed to load archived tickets' });
  }
};

export const getAllSupportMessages = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('support_messages')
      .select(`
        *,
        ticket:notifications(title, actor:users!actor_user_id(name, email)),
        sender:users!sender_user_id(name, email, imageUrl)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    console.error('[Support] Load All Messages Error:', err);
    res.status(500).json({ error: 'Failed to load support message logs' });
  }
};

export const replyToSupportTicket = async (req, res) => {
  try {
    const { id: ticketId } = req.params;
    const { message } = req.body;
    const senderId = req.user?.id;

    if (!message) return res.status(400).json({ error: 'Message is required' });

    // 1. Verify existence and get recipient (organizer)
    const { data: ticket, error: ticketErr } = await supabase
      .from('notifications')
      .select('*, actor:users!actor_user_id(userId, email, name)')
      .eq('notification_id', ticketId)
      .single();

    if (ticketErr || !ticket) return res.status(404).json({ error: 'Ticket not found' });

    // 2. Resolve sender role to determine if it's an admin reply
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('userId', senderId)
      .maybeSingle();
    
    const isAdmin = userData?.role === 'ADMIN';

    // 3. Insert into support_messages
    const { data: reply, error: replyErr } = await supabase
      .from('support_messages')
      .insert({
        notification_id: ticketId,
        sender_user_id: senderId,
        message,
        is_admin_reply: isAdmin
      })
      .select('*')
      .single();

    if (replyErr) throw replyErr;

    // 4. Notify the recipient (new notification)
    const recipientId = isAdmin ? ticket.actor_user_id : ticket.recipient_user_id;

    await supabase.from('notifications').insert({
      recipient_user_id: recipientId,
      actor_user_id: senderId,
      type: isAdmin ? 'SUPPORT_REPLY' : 'SUPPORT_MESSAGE', // Use SUPPORT_MESSAGE for user replies to avoid creating a "new concern"
      title: isAdmin ? `Reply to: ${ticket.title}` : `New message on: ${ticket.title}`,
      message: message,
      metadata: {
        ticketId: ticketId,
        parentTitle: ticket.title
      }
    });

    // 5. If it's a user reply, mark the original ticket as 'unread' (open) for the admin again
    if (!isAdmin) {
      await supabase.from('notifications')
        .update({ 
          is_read: false,
          metadata: { ...ticket.metadata, status: 'open' } // Re-open if it was resolved? 
        })
        .eq('notification_id', ticketId);
    }

    // 6. Send Email if it's an admin reply to organizer
    if (isAdmin) {
      try {
        const adminSmtp = await getAdminSmtpConfig();
        if (adminSmtp) {
           await sendSmtpEmail({
             to: ticket.actor?.email,
             subject: `[Support Reply] Re: ${ticket.title}`,
             text: message,
              html: `
                <div style="font-family: 'Inter', sans-serif; background-color: #F8FAFC; padding: 60px 20px; color: #0F172A;">
                  <div style="max-width: 520px; margin: 0 auto;">
                    <div style="text-align: center; margin-bottom: 40px;">
                      <img src="https://xmjdcbzgdfylbqkjoyyb.supabase.co/storage/v1/object/public/startuplab-business-ticketing/assets/assets/image%20(1).svg" height="80" alt="StartupLab Logo">
                    </div>
                    
                    <div style="background-color: #FFFFFF; border-radius: 12px; border: 1px solid #E2E8F0; padding: 50px; shadow: 0 40px 80px rgba(46, 46, 47, 0.05);">
                      <div style="margin-bottom: 30px;">
                        <span style="display: inline-block; padding: 8px 14px; background-color: #38BDF2; color: #FFFFFF; font-size: 10px; font-weight: 800; letter-spacing: 0.15em; text-transform: uppercase; border-radius: 10px;">SUPPORT REPLY</span>
                      </div>
                      
                      <h2 style="font-size: 24px; font-weight: 800; letter-spacing: -0.04em; line-height: 1.2; margin: 0 0 24px 0;">Hi ${ticket.actor?.name || 'Organizer'},</h2>
                      <p style="font-size: 15px; line-height: 1.6; color: #475569; margin-bottom: 32px;">
                        An administrator has replied to your request regarding <strong>"${ticket.title}"</strong>:
                      </p>

                      <div style="background-color: #F1F5F9; padding: 24px; border-radius: 12px; border-left: 4px solid #38BDF2; font-size: 16px; line-height: 1.6; color: #0F172A; margin-bottom: 32px;">
                        ${formatEmailMessage(message)}
                      </div>

                      <a href="${process.env.FRONTEND_URL || 'https://startuplab.ph'}/#/organizer-support" style="display: block; width: 100%; padding: 20px 0; background-color: #0F172A; color: #FFFFFF; font-size: 14px; font-weight: 700; text-align: center; text-decoration: none; border-radius: 12px; letter-spacing: 0.1em;">
                        VIEW SUPPORT HISTORY
                      </a>
                    </div>

                    <div style="text-align: center; margin-top: 50px;">
                      <p style="font-size: 11px; color: #94A3B8; line-height: 1.6;">
                        &copy; 2026 StartupLab Business Ticketing. All rights reserved.
                      </p>
                    </div>
                  </div>
                </div>
              `,
             from: `StartupLab Support <${adminSmtp.fromAddress}>`,
             config: adminSmtp,
           });
        }
      } catch (e) { 
        console.error('[Support] Email reply failed:', e.message); 
      }
    }

    res.json(reply);
  } catch (err) {
    console.error('[Support] Reply Error:', err);
    res.status(500).json({ error: 'Failed to send reply' });
  }
};

// Public contact form endpoint: thanks the sender and forwards to the admin mailbox.
export const submitContactForm = async (req, res) => {
  try {
    const {
      name,
      occupation,
      email,
      mobileNumber,
      inquiryType,
      message
    } = req.body || {};

    if (!name || !email || !mobileNumber || !message) {
      return res.status(400).json({ error: 'Name, email, mobile number, and message are required.' });
    }

    const adminSmtp = await getAdminSmtpConfig();
    if (!adminSmtp) {
      return res.status(500).json({ error: 'Email is not configured. Please try again later.' });
    }

    // Thank-you email to sender
    const safeName = name || 'Guest';
    const thankSubject = 'Thanks for contacting StartupLab Events Support';
    const thankText = `Hi ${safeName},\n\nWe have received your message regarding: ${inquiryType || 'Support'}\n\nOur team is reviewing your request and will get back to you shortly.\n\nMessage Details:\n${message}\n\n— StartupLab Support Team`;
    const thankHtml = `
      <div style="font-family: 'Inter', sans-serif; background-color: #F8FAFC; padding: 60px 20px; color: #0F172A;">
        <div style="max-width: 520px; margin: 0 auto;">
          <div style="text-align: center; margin-bottom: 40px;">
            <img src="https://xmjdcbzgdfylbqkjoyyb.supabase.co/storage/v1/object/public/startuplab-business-ticketing/assets/assets/image%20(1).svg" height="80" alt="StartupLab Logo">
          </div>
          
          <div style="background-color: #FFFFFF; border-radius: 12px; border: 1px solid #E2E8F0; padding: 50px; shadow: 0 40px 80px rgba(46, 46, 47, 0.05);">
            <div style="margin-bottom: 30px;">
              <span style="display: inline-block; padding: 8px 14px; background-color: #38BDF2; color: #FFFFFF; font-size: 10px; font-weight: 800; letter-spacing: 0.15em; text-transform: uppercase; border-radius: 10px;">QUERY RECEIVED</span>
            </div>
            
            <h2 style="font-size: 24px; font-weight: 800; letter-spacing: -0.04em; line-height: 1.2; margin: 0 0 24px 0;">Hi ${safeName},</h2>
            <p style="font-size: 15px; line-height: 1.6; color: #475569; margin-bottom: 32px;">
              Thanks for reaching out! Our team has received your message and we'll get back to you shortly.
            </p>

            <div style="background-color: #F8FAFC; padding: 24px; border-radius: 12px; border: 1px solid #E2E8F0; margin-bottom: 32px;">
              <p style="margin: 0 0 16px; font-size: 10px; font-weight: 800; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.1em;">Inquiry Details</p>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 4px 0; font-size: 13px; color: #64748B; width: 120px;">Type:</td>
                  <td style="padding: 4px 0; font-size: 13px; font-weight: 700;">${inquiryType || 'General'}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; font-size: 13px; color: #64748B;">Mobile:</td>
                  <td style="padding: 4px 0; font-size: 13px; font-weight: 700;">${mobileNumber}</td>
                </tr>
              </table>
              <div style="margin-top: 20px; pt-16px; border-top: 1px dashed #E2E8F0; padding-top: 16px; font-size: 14px; color: #475569; font-style: italic;">
                "${formatEmailMessage(message || '')}"
              </div>
            </div>

            <p style="font-size: 14px; font-weight: 700; color: #0F172A;">— StartupLab Support Team</p>
          </div>

          <div style="text-align: center; margin-top: 50px;">
            <p style="font-size: 11px; color: #94A3B8; line-height: 1.6;">
              &copy; 2026 StartupLab Business Ticketing. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    `;

    await sendSmtpEmail({
      to: email,
      subject: thankSubject,
      text: thankText,
      html: thankHtml,
      from: `StartupLab Support <${adminSmtp.fromAddress}>`,
      config: adminSmtp,
    });

    // Forward to admin
    const { data: adminUser } = await supabase
      .from('users')
      .select('email')
      .eq('role', 'ADMIN')
      .limit(1)
      .maybeSingle();

    if (adminUser?.email) {
      const forwardSubject = `[Contact Form] ${inquiryType || 'General'} - ${safeName}`;
      const forwardText = `${safeName} submitted the contact form.\nEmail: ${email}\nMobile: ${mobileNumber}\nOccupation: ${occupation || 'N/A'}\nInquiry Type: ${inquiryType || 'General'}\n\n${message}`;
      const forwardHtml = `
        <div style="font-family: 'Inter', sans-serif; background-color: #F8FAFC; padding: 60px 20px; color: #0F172A;">
          <div style="max-width: 520px; margin: 0 auto;">
            <div style="text-align: center; margin-bottom: 40px;">
              <img src="https://xmjdcbzgdfylbqkjoyyb.supabase.co/storage/v1/object/public/startuplab-business-ticketing/assets/assets/image%20(1).svg" height="80" alt="StartupLab Logo">
            </div>
            
            <div style="background-color: #FFFFFF; border-radius: 12px; border: 1px solid #E2E8F0; padding: 50px; shadow: 0 40px 80px rgba(46, 46, 47, 0.05);">
              <div style="margin-bottom: 30px;">
                <span style="display: inline-block; padding: 8px 14px; background-color: #38BDF2; color: #FFFFFF; font-size: 10px; font-weight: 800; letter-spacing: 0.15em; text-transform: uppercase; border-radius: 10px;">CONTACT FORWARD</span>
              </div>
              
              <h1 style="font-size: 24px; font-weight: 800; letter-spacing: -0.04em; line-height: 1.1; margin: 0 0 24px 0;">New Guest Inquiry</h1>
              
              <table style="width: 100%; border-collapse: collapse; margin-bottom: 32px;">
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #F1F5F9; font-size: 14px; color: #64748B;">Name</td>
                  <td style="padding: 12px 0; border-bottom: 1px solid #F1F5F9; font-size: 14px; font-weight: 700;">${safeName}</td>
                </tr>
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #F1F5F9; font-size: 14px; color: #64748B;">Email</td>
                  <td style="padding: 12px 0; border-bottom: 1px solid #F1F5F9; font-size: 14px; font-weight: 700;"><a href="mailto:${email}" style="color: #38BDF2; text-decoration: none;">${email}</a></td>
                </tr>
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #F1F5F9; font-size: 14px; color: #64748B;">Mobile</td>
                  <td style="padding: 12px 0; border-bottom: 1px solid #F1F5F9; font-size: 14px; font-weight: 700;">${mobileNumber}</td>
                </tr>
              </table>

              <div style="background-color: #F8FAFC; padding: 24px; border-radius: 12px; font-size: 16px; line-height: 1.6; color: #475569; border: 1px solid #E2E8F0;">
                ${formatEmailMessage(message || '')}
              </div>
            </div>

            <div style="text-align: center; margin-top: 50px;">
              <p style="font-size: 11px; color: #94A3B8; line-height: 1.6;">
                StartupLab Admin Notification • ${new Date().toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      `;

      await sendSmtpEmail({
        to: adminUser.email,
        subject: forwardSubject,
        text: forwardText,
        html: forwardHtml,
        replyTo: email,
        from: `Contact Form <${adminSmtp.fromAddress}>`,
        config: adminSmtp,
      });

      // Also create an In-App Notification for the Admin! (User request match)
      const { data: adminFull } = await supabase
        .from('users')
        .select('userId')
        .eq('email', adminUser.email)
        .maybeSingle();

      if (adminFull?.userId) {
        await supabase.from('notifications').insert({
          recipient_user_id: adminFull.userId,
          type: 'SUPPORT_TICKET', // Keep same type for Admin filtering
          title: `Guest Inquiry: ${inquiryType || 'General'}`,
          message: `${safeName} (${email}): ${message}`,
          metadata: {
            status: 'open',
            orgName: safeName,
            guestName: safeName,
            guestEmail: email,
            guestMobile: mobileNumber,
            category: inquiryType || 'Support',
            isGuest: true
          },
          is_read: false
        });
      }
    }

    return res.json({ success: true });
  } catch (err) {
    console.error('[Contact] submitContactForm error:', err);
    return res.status(500).json({ error: 'Failed to send your message. Please try again later.' });
  }
};

export const getSupportMessages = async (req, res) => {
  try {
    const { id: ticketId } = req.params;
    const { data, error } = await supabase
      .from('support_messages')
      .select('*, sender:users!sender_user_id(name, email)')
      .eq('notification_id', ticketId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    console.error('[Support] Load Messages Error:', err);
    res.status(500).json({ error: 'Failed to load messages' });
  }
};

export const bulkArchiveSupportTickets = async (req, res) => {
  try {
    const { ids } = req.body;
    const userId = req.user?.id;
    if (!ids || !Array.isArray(ids)) return res.status(400).json({ error: 'List of ticket IDs is required' });

    for (const id of ids) {
      const { data: current } = await supabase.from('notifications').select('metadata').eq('notification_id', id).single();
      await supabase.from('notifications').update({
        is_archived: true,
        metadata: { ...(current?.metadata || {}), status: 'archived' }
      })
      .eq('notification_id', id)
      .eq('actor_user_id', userId);
    }

    res.json({ success: true, message: `${ids.length} tickets archived.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const bulkDeleteSupportTickets = async (req, res) => {
  try {
    const { ids } = req.body;
    const userId = req.user?.id;
    if (!ids || !Array.isArray(ids)) return res.status(400).json({ error: 'List of ticket IDs is required' });

    // 1. Delete associated messages first
    await supabase.from('support_messages').delete().in('notification_id', ids);

    // 2. Delete the actual notifications
    const { error } = await supabase.from('notifications')
      .delete()
      .in('notification_id', ids)
      .eq('actor_user_id', userId);

    if (error) throw error;

    res.json({ success: true, message: `${ids.length} tickets deleted.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const bulkRestoreSupportTickets = async (req, res) => {
  try {
    const { ids } = req.body;
    const userId = req.user?.id;
    if (!ids || !Array.isArray(ids)) return res.status(400).json({ error: 'List of ticket IDs is required' });

    for (const id of ids) {
      const { data: current } = await supabase.from('notifications').select('metadata').eq('notification_id', id).single();
      await supabase.from('notifications').update({
        is_archived: false,
        metadata: { ...(current?.metadata || {}), status: 'open' }
      })
      .eq('notification_id', id)
      .eq('actor_user_id', userId);
    }

    res.json({ success: true, message: `${ids.length} tickets restored.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
