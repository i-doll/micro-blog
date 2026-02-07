import { AckPolicy, DeliverPolicy, StringCodec } from 'nats';
import { POST_PUBLISHED, type EventEnvelope, type PostPublished } from '@blog/shared';
import { getNatsConnection } from '../services/nats.js';
import * as notificationService from '../services/notification.js';

const sc = StringCodec();

export async function subscribePostPublished() {
  const nc = getNatsConnection();
  const js = nc.jetstream();
  const jsm = await nc.jetstreamManager();

  await jsm.consumers.add('BLOG_EVENTS', {
    durable_name: 'notification-service-post-published',
    filter_subject: POST_PUBLISHED,
    ack_policy: AckPolicy.Explicit,
    deliver_policy: DeliverPolicy.New,
  });

  const consumer = await js.consumers.get('BLOG_EVENTS', 'notification-service-post-published');
  const iter = await consumer.consume();

  (async () => {
    for await (const msg of iter) {
      try {
        const envelope: EventEnvelope<PostPublished> = JSON.parse(sc.decode(msg.data));
        const { post_id, author_id, title } = envelope.payload;
        console.log(`Post published: ${title} by ${author_id}`);

        await notificationService.createNotification(
          author_id,
          'post_published',
          `Your post "${title}" has been published`,
          { post_id },
        );

        msg.ack();
      } catch (err) {
        console.error('Error processing post.published:', err);
        msg.nak();
      }
    }
  })();

  console.log('Subscribed to post.published events');
}
