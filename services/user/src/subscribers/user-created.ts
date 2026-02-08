import { AckPolicy, DeliverPolicy, StringCodec } from 'nats';
import { USER_CREATED, type EventEnvelope, type UserCreated } from '@blog/shared';
import { getNatsConnection } from '../services/nats.js';
import { db, schema } from '../db/index.js';

const sc = StringCodec();

export async function subscribeUserCreated() {
  const nc = getNatsConnection();
  const js = nc.jetstream();
  const jsm = await nc.jetstreamManager();

  await jsm.consumers.add('BLOG_EVENTS', {
    durable_name: 'user-service-user-created',
    filter_subject: USER_CREATED,
    ack_policy: AckPolicy.Explicit,
    deliver_policy: DeliverPolicy.New,
  });

  const consumer = await js.consumers.get('BLOG_EVENTS', 'user-service-user-created');
  const iter = await consumer.consume();

  (async () => {
    for await (const msg of iter) {
      try {
        const envelope: EventEnvelope<UserCreated> = JSON.parse(sc.decode(msg.data));
        const { user_id, username, email, role } = envelope.payload;

        await db
          .insert(schema.users)
          .values({
            id: user_id,
            username,
            email,
            role: role || 'user',
          })
          .onConflictDoNothing();

        console.log(`Created user profile for ${user_id} (${username})`);
        msg.ack();
      } catch (err) {
        console.error('Error processing user.created:', err);
        msg.nak();
      }
    }
  })();
}
