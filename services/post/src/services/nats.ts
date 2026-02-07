import { connect, NatsConnection, JetStreamClient, JetStreamManager } from 'nats';
import { STREAM_NAME, STREAM_SUBJECTS } from '@blog/shared';
import { config } from '../config.js';

let nc: NatsConnection;
let js: JetStreamClient;

export async function connectNats(): Promise<void> {
  nc = await connect({ servers: config.natsUrl });
  console.log(`Connected to NATS at ${config.natsUrl}`);

  const jsm: JetStreamManager = await nc.jetstreamManager();

  try {
    await jsm.streams.info(STREAM_NAME);
  } catch {
    await jsm.streams.add({
      name: STREAM_NAME,
      subjects: [STREAM_SUBJECTS],
    });
    console.log(`Created JetStream stream: ${STREAM_NAME}`);
  }

  js = nc.jetstream();
}

export function getJetStream(): JetStreamClient {
  return js;
}

export function getNatsConnection(): NatsConnection {
  return nc;
}

export async function disconnectNats(): Promise<void> {
  if (nc) {
    await nc.drain();
  }
}
