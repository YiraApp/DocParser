import { db } from '@/lib/db';

export default async function handler(req, res) {
  const email = req.session?.user?.email;
  if (!email) return res.status(401).json({ error: 'Not logged in' });

  // Get user id from accounts table
  const userResult = await db.query('SELECT id FROM public.accounts WHERE email = $1', [email]);
  if (userResult.rows.length === 0) return res.status(404).json({ error: 'User not found' });

  const userId = userResult.rows[0].id;

  // Get documents for this user
  const docsResult = await db.query(
    'SELECT * FROM public.documents WHERE user_id = $1 ORDER BY created_at DESC',
    [userId]
  );

  // Always return a JSON array, even if empty
  res.status(200).json(docsResult.rows || []);
}

useEffect(() => {
    if (user) {
        fetch("/api/recent-documents")
            .then(res => res.text())
            .then(text => {
                try {
                    return JSON.parse(text)
                } catch {
                    return []
                }
            })
            .then(data => setRecentDocuments(data))
    }
}, [user])