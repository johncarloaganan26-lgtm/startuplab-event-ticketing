import supabase from '../database/db.js';
import { sendSmtpEmail } from '../utils/smtpMailer.js';
import { getAdminSmtpConfig } from '../utils/notificationService.js';

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
      .select('userId, email, name')
      .eq('role', 'ADMIN')
      .limit(1)
      .maybeSingle();

    if (!adminUser) {
      return res.status(404).json({ error: 'System administrator not found.' });
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
    try {
      const adminSmtp = await getAdminSmtpConfig();
      if (adminSmtp) {
        const htmlBody = `
          <h2>New Support Request: ${subject}</h2>
          <p><strong>From Organizer:</strong> ${fromOrgName}</p>
          <hr />
          <p>${message.replace(/\n/g, '<br/>')}</p>
          <br/>
          <p><small>This ticket was submitted via the Organizer Support Center.</small></p>
        `;

        await sendSmtpEmail({
          to: adminUser.email,
          subject: `[Support Ticket] ${subject}`,
          text: message,
          html: htmlBody,
          replyTo: req.user?.email, // Allow admin to reply directly back to org
          from: `System <${adminSmtp.fromAddress}>`,
          config: adminSmtp,
        });
      } else {
        console.warn('[Support] Admin SMTP not configured, skipping realtime email delivery.');
      }
    } catch (emailErr) {
      console.error('[Support] Real-time email failed:', emailErr);
      // We don't fail the request if the email fails, the ticket is still in the system
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
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    console.error('[Support] Load My Tickets Error:', err);
    res.status(500).json({ error: 'Failed to load support history' });
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
               <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eeeeee; border-radius: 10px;">
                 <h3 style="color: #38BDF2;">Support Team Reply</h3>
                 <p>Hi ${ticket.actor?.name || 'Organizer'},</p>
                 <p>An administrator has replied to your support request <strong>"${ticket.title}"</strong>:</p>
                 <div style="background: #f9f9f9; padding: 15px; border-left: 4px solid #38BDF2; margin: 20px 0;">
                   ${message.replace(/\n/g, '<br/>')}
                 </div>
                 <p style="font-size: 12px; color: #666;">You can view and respond to this message in your Organizer Dashboard Support section.</p>
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
    const thankText = `Hi ${safeName},\n\nThanks for reaching out about your event needs. We received your message and will reply shortly.\n\nInquiry Type: ${inquiryType || 'General'}\nMobile: ${mobileNumber}\nOccupation: ${occupation || 'N/A'}\n\n${message}\n\n— StartupLab Support Team`;
    const thankHtml = `
      <p>Hi ${safeName},</p>
      <p>Thanks for reaching out about your event needs. Our team has received your message and will reply shortly.</p>
      <p><strong>What you sent:</strong></p>
      <ul>
        <li><strong>Inquiry Type:</strong> ${inquiryType || 'General'}</li>
        <li><strong>Mobile:</strong> ${mobileNumber}</li>
        ${occupation ? `<li><strong>Occupation:</strong> ${occupation}</li>` : ''}
      </ul>
      <p>${(message || '').replace(/\n/g, '<br/>')}</p>
      <p>— StartupLab Support Team</p>
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
        <p><strong>Name:</strong> ${safeName}</p>
        <p><strong>Occupation:</strong> ${occupation || '—'}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Mobile:</strong> ${mobileNumber}</p>
        <p><strong>Inquiry Type:</strong> ${inquiryType || 'General'}</p>
        <p><strong>Message:</strong></p>
        <p>${(message || '').replace(/\n/g, '<br/>')}</p>
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
