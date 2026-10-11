import type { Protocol, State, Event, Transition } from './types.ts';
const s = (id: string, label: string, x: number, y: number, description: string, accepting = false, outcome?: 'success' | 'failure'): State => ({ id, label, x, y, description, accepting, outcome });
const e = (id: string, short: string, label: string, direction: string, description: string): Event => ({ id, short, label, direction, description });
const t = (from: string, event: string, to: string, explanation: string): Transition => ({ from, event, to, explanation });
export const protocols: Protocol[] = [
  {
    id: 'smtp', name: 'SMTP', subtitle: 'Email transaction', initial: 'READY', trap: 'REJECT',
    scope: 'One mail transaction after the greeting and EHLO exchange. Models explicit commands and selected replies; excludes PIPELINING, STARTTLS, AUTH, extensions, and full reply-code handling. RSET is modeled between commands.',
    acceptance: 'COMPLETE means the email was accepted. FAILED means a valid transaction ended with a server refusal. Both are accepting protocol transcripts. A server refusal is not a protocol violation.',
    source: 'https://www.rfc-editor.org/rfc/rfc5321.html',
    states: [
      s('READY','Ready',0,0,'Greeting and EHLO completed; ready for a mail transaction.'),
      s('WAIT_MAIL','Await sender reply',240,0,'MAIL FROM sent; waiting for the server.'),
      s('SENDER','Sender accepted',480,0,'A sender is established; no recipients accepted yet.'),
      s('WAIT_FIRST','Await first recipient',720,0,'Waiting for the first RCPT TO response.'),
      s('RECIPIENT','Recipient accepted',720,220,'At least one recipient was accepted.'),
      s('WAIT_MORE','Await extra recipient',480,220,'An additional recipient is pending; previous recipients remain accepted.'),
      s('WAIT_DATA','Await DATA reply',960,220,'DATA sent; do not send the body until 354.'),
      s('BODY','Reading body',960,440,'Server invited the body with 354. BODY_END abstracts the SMTP terminator.'),
      s('WAIT_FINAL','Await final reply',720,440,'Message terminator received; waiting for acceptance or refusal.'),
      s('COMPLETE','Email accepted',480,440,'Server accepted the email; the modeled transaction is complete.',true,'success'),
      s('FAILED','Server refused',240,440,'A supported server refusal ends this transaction without violating command order.',true,'failure'),
      s('WAIT_RESET','Await reset reply',240,220,'RSET sent; waiting for 250 before starting again.'),
      s('REJECT','Trap',0,440,'The input violates this model. The trap rejects all remaining input.')
    ],
    alphabet: [
      e('C_MAIL','MAIL','MAIL FROM:<alice@example.test>','Client → server','Starts a mail transaction.'),
      e('C_RCPT','RCPT','RCPT TO:<bob@example.test>','Client → server','Adds a recipient to the current transaction.'),
      e('C_DATA','DATA','DATA','Client → server','Requests permission to transmit the message body.'),
      e('C_BODY_END','BODY_END','Message body + <CRLF>.<CRLF>','Client → server','Abstracts a correctly framed body and its terminator.'),
      e('C_RSET','RSET','RSET','Client → server','Requests clearing the current transaction.'),
      e('S_250','250','250 OK','Server → client','Positive completion, interpreted according to the pending command.'),
      e('S_354','354','354 Start mail input','Server → client','Invites the client to send the body.'),
      e('S_550','550','550 Requested action not taken','Server → client','A supported refusal. Context determines whether retry is possible.')
    ],
    transitions: [
      t('READY','C_MAIL','WAIT_MAIL','Sender request queued; wait for its reply.'),t('WAIT_MAIL','S_250','SENDER','The sender was accepted.'),t('WAIT_MAIL','S_550','FAILED','Server refused the sender; transaction failed cleanly.'),
      t('SENDER','C_RCPT','WAIT_FIRST','First recipient request sent.'),t('WAIT_FIRST','S_250','RECIPIENT','First recipient accepted; DATA can now be requested.'),t('WAIT_FIRST','S_550','SENDER','Recipient refused; another recipient may be tried.'),
      t('RECIPIENT','C_RCPT','WAIT_MORE','Additional recipient requested; accepted recipients are retained.'),t('WAIT_MORE','S_250','RECIPIENT','Additional recipient accepted.'),t('WAIT_MORE','S_550','RECIPIENT','Additional recipient refused; the first recipient remains valid.'),
      t('RECIPIENT','C_DATA','WAIT_DATA','Wait for the server to invite body transmission.'),t('WAIT_DATA','S_354','BODY','354 authorizes body transmission.'),t('BODY','C_BODY_END','WAIT_FINAL','Body completed; delivery acceptance is still pending.'),t('WAIT_FINAL','S_250','COMPLETE','Server accepted the completed email.'),t('WAIT_FINAL','S_550','FAILED','Server refused the completed email; this is a valid negative outcome.'),
      ...['READY','SENDER','RECIPIENT'].map(state=>t(state,'C_RSET','WAIT_RESET','Reset requested between commands.')),t('WAIT_RESET','S_250','READY','Server confirmed reset; sender and recipients are cleared.')
    ],
    scenarios: [
      {id:'success',name:'Successful email',category:'success',description:'A complete sender, recipient, DATA and message acceptance exchange.',events:['C_MAIL','S_250','C_RCPT','S_250','C_DATA','S_354','C_BODY_END','S_250'],expected:'accepted',outcome:'success'},
      {id:'recipients',name:'Multiple recipients',category:'success',description:'Add a second recipient before sending the message.',events:['C_MAIL','S_250','C_RCPT','S_250','C_RCPT','S_250','C_DATA','S_354','C_BODY_END','S_250'],expected:'accepted'},
      {id:'recovery',name:'Recipient refused, then recovered',category:'recovery',description:'A 550 refusal leaves the transaction open; try another recipient.',events:['C_MAIL','S_250','C_RCPT','S_550','C_RCPT','S_250','C_DATA','S_354','C_BODY_END','S_250'],expected:'accepted'},
      {id:'extra-refused',name:'Extra recipient refused',category:'recovery',description:'A refusal of a second recipient does not erase the first accepted recipient.',events:['C_MAIL','S_250','C_RCPT','S_250','C_RCPT','S_550','C_DATA','S_354','C_BODY_END','S_250'],expected:'accepted'},
      {id:'reset',name:'Reset and start again',category:'recovery',description:'Clear the transaction, await the reset response, then begin a new one.',events:['C_MAIL','S_250','C_RCPT','S_250','C_RSET','S_250','C_MAIL','S_250','C_RCPT','S_250','C_DATA','S_354','C_BODY_END','S_250'],expected:'accepted'},
      {id:'early-data',name:'DATA without a recipient',category:'violation',description:'The client requests DATA before any recipient has been accepted.',events:['C_MAIL','S_250','C_DATA'],expected:'rejected'},
      {id:'early-body',name:'Body before permission',category:'violation',description:'The client sends the body without waiting for the 354 reply.',events:['C_MAIL','S_250','C_RCPT','S_250','C_DATA','C_BODY_END'],expected:'rejected'},
      {id:'failed',name:'Server refuses the email',category:'failure',description:'Command order is valid, but the final server reply refuses the message.',events:['C_MAIL','S_250','C_RCPT','S_250','C_DATA','S_354','C_BODY_END','S_550'],expected:'accepted',outcome:'failure'},
      {id:'incomplete',name:'Waiting for final acceptance',category:'incomplete',description:'The message was sent, but the final server reply has not arrived.',events:['C_MAIL','S_250','C_RCPT','S_250','C_DATA','S_354','C_BODY_END'],expected:'incomplete'}
    ]
  },
  {
    id:'mqtt',name:'MQTT',subtitle:'QoS 2 message delivery',initial:'READY',trap:'REJECT',
    scope:'One successful-reason-code QoS 2 exchange on an established MQTT session. Packet identifier checks are abstracted into MATCHED or BAD_ID events. Excludes session establishment, reconnect recovery, other messages and MQTT 5 failure reason codes.',
    acceptance:'COMPLETE means the four-message QoS 2 delivery exchange has finished. Other states are prefixes; acknowledgements for a different packet identifier are rejected.',source:'https://docs.oasis-open.org/mqtt/mqtt/v5.0/os/mqtt-v5.0-os.html',
    states:[s('READY','Ready',0,180,'Session already connected; ready to publish.'),s('WAIT_REC','Await PUBREC',240,180,'QoS 2 PUBLISH sent.'),s('WAIT_REL','Await PUBREL',480,180,'PUBREC received for the tracked packet identifier.'),s('WAIT_COMP','Await PUBCOMP',720,180,'PUBREL sent; awaiting final acknowledgement.'),s('COMPLETE','Delivery complete',960,180,'PUBCOMP confirms completion.',true,'success'),s('REJECT','Trap',480,440,'Invalid ordering or mismatched packet identifier.')],
    alphabet:[e('C_PUBLISH','PUBLISH','PUBLISH QoS=2, packetId=42','Publisher → receiver','Starts the tracked QoS 2 exchange.'),e('S_PUBREC','PUBREC','PUBREC packetId=42','Receiver → publisher','Positive receipt acknowledgement with matching identifier.'),e('C_PUBREL','PUBREL','PUBREL packetId=42','Publisher → receiver','Releases the same tracked message.'),e('S_PUBCOMP','PUBCOMP','PUBCOMP packetId=42','Receiver → publisher','Completes the tracked exchange.'),e('BAD_ID','BAD_ID','Acknowledgement packetId=99','Either direction','Classifier detects an identifier that does not match packet 42.')],
    transitions:[t('READY','C_PUBLISH','WAIT_REC','Start a QoS 2 exchange.'),t('WAIT_REC','S_PUBREC','WAIT_REL','Matching PUBREC received.'),t('WAIT_REL','C_PUBREL','WAIT_COMP','Matching PUBREL sent.'),t('WAIT_COMP','S_PUBCOMP','COMPLETE','Delivery exchange completed.')],
    scenarios:[
      {id:'success',name:'Complete QoS 2 exchange',category:'success',description:'The ordered four-message delivery exchange for packet 42.',events:['C_PUBLISH','S_PUBREC','C_PUBREL','S_PUBCOMP'],expected:'accepted'},
      {id:'release-early',name:'Release before receipt',category:'violation',description:'PUBREL arrives before the PUBREC acknowledgement.',events:['C_PUBLISH','C_PUBREL','S_PUBCOMP'],expected:'rejected'},
      {id:'wrong-id',name:'Acknowledgement for another message',category:'violation',description:'The packet classifier identifies a mismatched packet identifier.',events:['C_PUBLISH','BAD_ID'],expected:'rejected'},
      {id:'comp-early',name:'Completion before release',category:'violation',description:'PUBCOMP arrives without the required PUBREL step.',events:['C_PUBLISH','S_PUBREC','S_PUBCOMP'],expected:'rejected'},
      {id:'incomplete',name:'Waiting for completion',category:'incomplete',description:'Three steps complete; the final PUBCOMP is still pending.',events:['C_PUBLISH','S_PUBREC','C_PUBREL'],expected:'incomplete'}
    ]
  },
  {
    id:'tcp',name:'TCP',subtitle:'Connection establishment',initial:'START',trap:'REJECT',
    scope:'Observer model of a normal active/passive three-way handshake, without data-bearing SYNs or simultaneous open. Sequence checks are performed by a hypothetical classifier; VALID_ACK means sequence and acknowledgement validation passed. This is not a full TCP implementation.',
    acceptance:'ESTABLISHED means the modeled handshake completed. This recognizer accepts an established connection prefix, not a fully closed TCP session.',source:'https://www.rfc-editor.org/rfc/rfc9293.html',
    states:[s('START','Start',0,180,'No SYN observed.'),s('WAIT_SYN_ACK','Await SYN-ACK',260,180,'Client SYN observed.'),s('WAIT_ACK','Await final ACK',520,180,'Server SYN-ACK observed and validated.'),s('ESTABLISHED','Established',780,180,'Final acknowledgement validated.',true,'success'),s('REJECT','Trap',520,440,'Trace violates the selected handshake subset.')],
    alphabet:[e('C_SYN','SYN','SYN seq=1000','Client → server','Initial SYN for this observed connection.'),e('S_SYN_ACK','SYN-ACK','SYN-ACK seq=9000 ack=1001','Server → client','Validated response to the client SYN.'),e('C_VALID_ACK','VALID_ACK','ACK seq=1001 ack=9001','Client → server','Valid final acknowledgement for SYNs without payload.'),e('C_RETRY_SYN','RETRY_SYN','Retransmitted SYN seq=1000','Client → server','Classifier recognizes a legitimate duplicate SYN.'),e('S_RETRY_SYN_ACK','RETRY_SYN_ACK','Retransmitted SYN-ACK','Server → client','Classifier recognizes a legitimate duplicate SYN-ACK.'),e('DATA','DATA','Valid data + ACK','Either direction','Validated segment after establishment.'),e('BAD_ACK','BAD_ACK','ACK seq=1001 ack=7777','Client → server','Incorrect acknowledgement cannot establish this connection.')],
    transitions:[t('START','C_SYN','WAIT_SYN_ACK','Initial SYN starts handshake tracking.'),t('WAIT_SYN_ACK','S_SYN_ACK','WAIT_ACK','Server SYN-ACK validates the client SYN.'),t('WAIT_SYN_ACK','C_RETRY_SYN','WAIT_SYN_ACK','Legitimate retransmission retains the state.'),t('WAIT_ACK','S_RETRY_SYN_ACK','WAIT_ACK','Repeated SYN-ACK retains the state.'),t('WAIT_ACK','C_VALID_ACK','ESTABLISHED','Valid final acknowledgement completes this handshake.'),t('ESTABLISHED','DATA','ESTABLISHED','Data transfer does not change the handshake state.')],
    scenarios:[
      {id:'success',name:'Handshake and data',category:'success',description:'A normal three-way handshake followed by application data.',events:['C_SYN','S_SYN_ACK','C_VALID_ACK','DATA','DATA'],expected:'accepted'},
      {id:'retry',name:'Lost packet and retransmission',category:'recovery',description:'Repeated handshake segments are recognized as legitimate retransmissions.',events:['C_SYN','C_RETRY_SYN','S_SYN_ACK','S_RETRY_SYN_ACK','C_VALID_ACK','DATA'],expected:'accepted'},
      {id:'bad-ack',name:'Invalid final acknowledgement',category:'violation',description:'The final acknowledgement does not acknowledge the server SYN.',events:['C_SYN','S_SYN_ACK','BAD_ACK','DATA'],expected:'rejected'},
      {id:'incomplete',name:'Handshake still pending',category:'incomplete',description:'Client SYN observed; server response has not arrived.',events:['C_SYN'],expected:'incomplete'}
    ]
  }
];
