import { AckPolicy, DeliverPolicy, StringCodec } from 'nats';
import { eq } from 'drizzle-orm';
import { USER_DELETED, type EventEnvelope, type UserDeleted } from '@blog/shared';
import { getNatsConnection } from '../services/nats.js';
import { db, schema } from '../db/index.js';

const sc = StringCodec();

export async function subscribeUserDeleted() {
  const nc = getNatsConnection();
  const js = nc.jetstream();
  const jsm = await nc.jetstreamManager();

  await jsm.consumers.add('BLOG_EVENTS', {
    durable_name: 'post-service-user-deleted',
    filter_subject: USER_DELETED,
    ack_policy: AckPolicy.Explicit,
    deliver_policy: DeliverPolicy.New,
  });

  const consumer = await js.consumers.get('BLOG_EVENTS', 'post-service-user-deleted');
  const iter = await consumer.consume();

  (async () => {
    for await (const msg of iter) {
      try {
        const envelope: EventEnvelope<UserDeleted> = JSON.parse(sc.decode(msg.data));
        const { user_id } = envelope.payload;
        console.log(`User deleted: ${user_id}, archiving their posts`);

        await db
          .update(schema.posts)
          .set({ status: 'archived', updated_at: new Date() })
          .where(eq(schema.posts.author_id, user_id));

        msg.ack();
      } catch (err) {
        console.error('Error processing user.deleted event:', err);
        msg.nak();
      }
    }
  })();

  console.log('Subscribed to user.deleted events');
}
