import { AckPolicy, DeliverPolicy, StringCodec } from 'nats';
import { USER_DELETED, type EventEnvelope, type UserDeleted } from '@blog/shared';
import { getNatsConnection } from '../services/nats.js';
import * as notificationService from '../services/notification.js';

const sc = StringCodec();

export async function subscribeUserDeleted() {
  const nc = getNatsConnection();
  const js = nc.jetstream();
  const jsm = await nc.jetstreamManager();

  await jsm.consumers.add('BLOG_EVENTS', {
    durable_name: 'notification-service-user-deleted',
    filter_subject: USER_DELETED,
    ack_policy: AckPolicy.Explicit,
    deliver_policy: DeliverPolicy.New,
  });

  const consumer = await js.consumers.get('BLOG_EVENTS', 'notification-service-user-deleted');
  const iter = await consumer.consume();

  (async () => {
    for await (const msg of iter) {
      try {
        const envelope: EventEnvelope<UserDeleted> = JSON.parse(sc.decode(msg.data));
        console.log(`User deleted: ${envelope.payload.user_id}, cleaning up notifications`);
        await notificationService.deleteUserNotifications(envelope.payload.user_id);
        msg.ack();
      } catch (err) {
        console.error('Error processing user.deleted:', err);
        msg.nak();
      }
    }
  })();

  console.log('Subscribed to user.deleted events');
}
