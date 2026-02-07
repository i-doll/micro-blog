import { AckPolicy, DeliverPolicy, StringCodec } from 'nats';
import { eq } from 'drizzle-orm';
import { POST_DELETED, type EventEnvelope, type PostDeleted } from '@blog/shared';
import { getNatsConnection } from '../services/nats.js';
import { db, schema } from '../db/index.js';

const sc = StringCodec();

export async function subscribePostDeleted() {
  const nc = getNatsConnection();
  const js = nc.jetstream();
  const jsm = await nc.jetstreamManager();

  await jsm.consumers.add('BLOG_EVENTS', {
    durable_name: 'comment-service-post-deleted',
    filter_subject: POST_DELETED,
    ack_policy: AckPolicy.Explicit,
    deliver_policy: DeliverPolicy.New,
  });

  const consumer = await js.consumers.get('BLOG_EVENTS', 'comment-service-post-deleted');
  const iter = await consumer.consume();

  (async () => {
    for await (const msg of iter) {
      try {
        const envelope: EventEnvelope<PostDeleted> = JSON.parse(sc.decode(msg.data));
        console.log(`Post deleted: ${envelope.payload.post_id}, deleting comments`);
        await db.delete(schema.comments).where(eq(schema.comments.post_id, envelope.payload.post_id));
        msg.ack();
      } catch (err) {
        console.error('Error processing post.deleted:', err);
        msg.nak();
      }
    }
  })();
}
