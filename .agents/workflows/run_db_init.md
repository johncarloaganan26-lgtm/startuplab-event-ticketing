---
description: Initialize database schema for RBAC, RLS, and audit logging
---

# Steps to apply the `init.sql` script to your PostgreSQL database

1. **Ensure PostgreSQL client is available**
   - On Windows you can install the PostgreSQL client tools from the official installer or use a Docker container.
   - Verify with `psql --version`.

2. **Set environment variables** (replace placeholders with your actual values):
   ```powershell
   $env:PGHOST="your-db-host"
   $env:PGPORT="5432"
   $env:PGDATABASE="your_database"
   $env:PGUSER="your_user"
   $env:PGPASSWORD="your_password"
   ```

3. **Run the initialization script**
   ```powershell
   psql -f "C:\Users\John Carlo\OneDrive\Desktop\startupevent\startuplab-business-ticketing\backend\database\init.sql"
   ```
   - If you prefer Docker, you can execute:
   ```bash
   docker run --rm \
     -e PGPASSWORD=$env:PGPASSWORD \
     -v "C:/Users/John Carlo/OneDrive/Desktop/startupevent/startuplab-business-ticketing/backend/database:/sql" \
     postgres:15 psql -h $env:PGHOST -U $env:PGUSER -d $env:PGDATABASE -f /sql/init.sql
   ```

4. **Verify the objects were created**
   ```sql
   SELECT * FROM public.role_permissions LIMIT 5;
   SELECT * FROM information_schema.tables WHERE table_name = 'audit_logs';
   ```
   You should see rows for the default permissions and the `audit_logs` table.

5. **Integrate the helper function**
   - In your application code (e.g., Node.js, TypeScript), call `set_current_user(userId, userEmail)` after successful authentication to enable the RLS policies.

6. **Commit the changes**
   - Add `init.sql` and this workflow file to version control.

---
*This workflow is safe to run multiple times; `CREATE TABLE IF NOT EXISTS` and `INSERT ... ON CONFLICT DO NOTHING` make it idempotent.*
