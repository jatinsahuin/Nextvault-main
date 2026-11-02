import type { FastifyInstance } from 'fastify';
import type { Config } from '../config.js';
import type { Db } from '../db/pool.js';
import { repo } from '../ingestion/repository.js';
import bcrypt from 'bcrypt';

export async function authRoutes(app: FastifyInstance, { config, db }: { config: Config; db: Db }) {

  // Register endpoint for new users
  app.post<{ Body: { email: string; password: string } }>('/auth/register', async (request, reply) => {
    const { email, password } = request.body;
    if (!email || !password) return reply.code(400).send({ error: 'Email and password required' });

    const hashedPassword = await bcrypt.hash(password, 10);

    try {
      const user = await db.query(
        'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id',
        [email, hashedPassword]
      );

      // Generate a token immediately for the new user
      const token = app.jwt.sign({ userId: user.rows[0].id });

      return reply.code(201).send({
        userId: user.rows[0].id,
        token,
        message: 'User registered successfully'
      });
    } catch (err: any) {
      if (err.code === '23505') return reply.code(409).send({ error: 'Email already registered' });
      throw err;
    }
  });

  // Login endpoint
  app.post<{ Body: { email: string; password: string } }>('/auth/login', async (request, reply) => {
    const { email, password } = request.body;

    const res = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = res.rows[0];

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return reply.code(401).send({ error: 'Invalid credentials' });
    }

    const token = app.jwt.sign({ userId: user.id });
    return { token };
  });
}
