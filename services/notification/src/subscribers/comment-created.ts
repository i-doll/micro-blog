import { AckPolicy, DeliverPolicy, StringCodec } from 'nats';
import { COMMENT_CREATED, type EventEnvelope, type CommentCreated } from '@blog/shared';
import { getNatsConnection } from '../services/nats.js';
import * as notificationService from '../services/notification.js';

const sc = StringCodec();

export async function subscribeCommentCreated() {
  const nc = getNatsConnection();
  const js = nc.jetstream();
  const jsm = await nc.jetstreamManager();

  await jsm.consumers.add('BLOG_EVENTS', {
    durable_name: 'notification-service-comment-created',
    filter_subject: COMMENT_CREATED,
    ack_policy: AckPolicy.Explicit,
    deliver_policy: DeliverPolicy.New,
  });

  const consumer = await js.consumers.get('BLOG_EVENTS', 'notification-service-comment-created');
  const iter = await consumer.consume();

  (async () => {
    for await (const msg of iter) {
      try {
        const envelope: EventEnvelope<CommentCreated> = JSON.parse(sc.decode(msg.data));
        const { post_id, author_id, comment_id } = envelope.payload;

        // In a real system, we'd look up the post author to notify them
        // For now, we create a generic notification
        console.log(`New comment on post ${post_id} by ${author_id}`);

        // We can't notify the post author directly since we don't have that info here.
        // In production, the event would include the post author_id, or we'd query the post service.
        // For now, create a system notification
        await notificationService.createNotification(
          author_id, // notification for the comment author (as a receipt) — in real impl, would be post author
          'comment_on_post',
          `New comment on post`,
          { post_id, comment_id, commenter_id: author_id },
        );

        msg.ack();
      } catch (err) {
        console.error('Error processing comment.created:', err);
        msg.nak();
      }
    }
  })();

  console.log('Subscribed to comment.created events');
}
