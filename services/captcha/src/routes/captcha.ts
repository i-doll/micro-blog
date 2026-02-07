import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { generateChallenge, verifyChallenge } from '../captcha.js';

const verifySchema = z.object({
  id: z.string().uuid(),
  answer: z.string().min(1).max(10),
});

export async function captchaRoutes(app: FastifyInstance) {
  app.get('/captcha/challenge', async (_request, reply) => {
    const challenge = generateChallenge();
    return reply.send(challenge);
  });

  app.post('/captcha/verify', async (request, reply) => {
    const body = verifySchema.parse(request.body);
    const token = verifyChallenge(body.id, body.answer);

    if (!token) {
      return reply.status(400).send({ error: 'Invalid or expired captcha' });
    }

    return reply.send({ captcha_token: token });
  });
}
