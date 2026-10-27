import {
  buildTwilioSignature,
  escapeXml,
  formParams,
  normalizeE164,
  spokenReply,
  twimlDocument,
  verifyTwilioSignature,
  wantsVoiceHandoff,
} from './voice-ai.util';

describe('voice AI helpers', () => {
  it('validates a real Twilio-style signature', () => {
    const url = 'https://almutamayiziq.com/api/webhooks/twilio/voice';
    const params = { CallSid: 'CA123', From: '+9647700000000', To: '+9647800000000' };
    const signature = buildTwilioSignature('test-token', url, params);
    expect(verifyTwilioSignature({ authToken: 'test-token', url, params, signature })).toBe(true);
  });

  it('rejects an invalid webhook signature', () => {
    const url = 'https://almutamayiziq.com/api/webhooks/twilio/voice';
    const params = { CallSid: 'CA123' };
    expect(
      verifyTwilioSignature({
        authToken: 'test-token',
        url,
        params,
        signature: 'aaaaaaaaaaaaaaaaaaaaaaaaaaa=',
      }),
    ).toBe(false);
    expect(verifyTwilioSignature({ authToken: 'test-token', url, params, signature: undefined })).toBe(false);
  });

  it('normalizes caller and called numbers for tenant routing', () => {
    expect(normalizeE164('+9647864314333')).toBe('+9647864314333');
    expect(normalizeE164('009647864314333')).toBe('+9647864314333');
  });

  it('detects human handoff in Iraqi Arabic and English', () => {
    expect(wantsVoiceHandoff('أريد أحچي ويا شخص')).toBe(true);
    expect(wantsVoiceHandoff('اربطني بالدعم')).toBe(true);
    expect(wantsVoiceHandoff('talk to a human')).toBe(true);
    expect(wantsVoiceHandoff('شلون أربط الواتساب')).toBe(false);
  });

  it('keeps spoken replies short and without markdown', () => {
    expect(spokenReply('**مرحبا** `code` https://wa.me/9647864314333')).toContain('wa.me/9647864314333');
    expect(spokenReply('**مرحبا**')).not.toContain('**');
  });

  it('builds TwiML for incoming gather sessions', () => {
    const xml = twimlDocument(`<Say>${escapeXml('أهلاً <بك>')}</Say>`);
    expect(xml).toContain('<Response>');
    expect(xml).toContain('أهلاً &lt;بك&gt;');
  });

  it('reads only string form fields from Twilio bodies', () => {
    expect(formParams({ CallSid: 'CA1', Extra: ['x'], skip: 1 })).toEqual({ CallSid: 'CA1', Extra: 'x' });
  });
});
