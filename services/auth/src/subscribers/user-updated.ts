import { AckPolicy, DeliverPolicy, StringCodec } from 'nats';
import { eq } from 'drizzle-orm';
import { USER_UPDATED, type EventEnvelope, type UserUpdated } from '@blog/shared';
import { getNatsConnection } from '../services/nats.js';
import { db, schema } from '../db/index.js';

const sc = StringCodec();

export async function subscribeUserUpdated() {
  const nc = getNatsConnection();
  const js = nc.jetstream();
  const jsm = await nc.jetstreamManager();

  await jsm.consumers.add('BLOG_EVENTS', {
    durable_name: 'auth-service-user-updated',
    filter_subject: USER_UPDATED,
    ack_policy: AckPolicy.Explicit,
    deliver_policy: DeliverPolicy.New,
  });

  const consumer = await js.consumers.get('BLOG_EVENTS', 'auth-service-user-updated');
  const iter = await consumer.consume();

  (async () => {
    for await (const msg of iter) {
      try {
        const envelope: EventEnvelope<UserUpdated> = JSON.parse(sc.decode(msg.data));
        const { user_id, username, email, role } = envelope.payload;

        const updates: Record<string, unknown> = { updated_at: new Date() };
        if (username) updates.username = username;
        if (email) updates.email = email;
        if (role) updates.role = role;

        await db
          .update(schema.credentials)
          .set(updates)
          .where(eq(schema.credentials.id, user_id));

        console.log(`Synced user update for ${user_id}`);
        msg.ack();
      } catch (err) {
        console.error('Error processing user.updated:', err);
        msg.nak();
      }
    }
  })();
}
