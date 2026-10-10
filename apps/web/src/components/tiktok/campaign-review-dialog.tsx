'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, Send, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { reviewTikTokCampaign } from '@/lib/tiktok-business';
import { parseApiError } from '@/lib/utils';

type Message = { role: 'user' | 'assistant'; content: string };

const FIRST_PROMPT = 'حلّل هذه الحملة: اكتشف الأخطاء، قيّم النتائج، واذكر طرق التحسين.';

export function CampaignReviewDialog({
  advertiserId,
  campaignId,
  campaignName,
  startDate,
  endDate,
  onClose,
}: {
  advertiserId: string;
  campaignId: string;
  campaignName: string;
  startDate: string;
  endDate: string;
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  async function send(history: Message[]) {
    setBusy(true);
    setError(null);
    try {
      const result = await reviewTikTokCampaign({ advertiserId, campaignId, startDate, endDate, messages: history });
      setMessages([...history, { role: 'assistant', content: result.reply }]);
    } catch (err) {
      setError(parseApiError(err));
      setMessages(history);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    const opening: Message[] = [{ role: 'user', content: FIRST_PROMPT }];
    setMessages(opening);
    setBusy(true);
    setError(null);
    reviewTikTokCampaign({ advertiserId, campaignId, startDate, endDate, messages: opening })
      .then((result) => {
        if (!cancelled) setMessages([...opening, { role: 'assistant', content: result.reply }]);
      })
      .catch((err) => {
        if (!cancelled) setError(parseApiError(err));
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [advertiserId, campaignId, startDate, endDate]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [messages, busy]);

  function submit() {
    const text = draft.trim();
    if (!text || busy) return;
    const history = [...messages, { role: 'user' as const, content: text }];
    setDraft('');
    setMessages(history);
    void send(history);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3 sm:items-center" onClick={onClose}>
      <div
        className="flex h-[min(720px,92vh)] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-background shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b px-4 py-3">
          <div>
            <p className="text-sm text-muted-foreground">تقييم بالذكاء الاصطناعي</p>
            <h2 className="font-semibold">{campaignName}</h2>
          </div>
          <Button type="button" size="icon" variant="ghost" onClick={onClose} aria-label="إغلاق">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div ref={scroller} className="flex-1 space-y-3 overflow-auto px-4 py-4">
          {messages.filter((message) => message.content !== FIRST_PROMPT).map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              className={`max-w-[90%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm leading-6 ${
                message.role === 'user' ? 'ms-auto bg-primary text-primary-foreground' : 'bg-muted'
              }`}
            >
              {message.content}
            </div>
          ))}
          {busy && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> الخبير يراجع الحملة…
            </p>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <form
          className="flex gap-2 border-t p-3"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="اسأل عن الحملة أو اطلب تحسيناً"
            className="h-10 flex-1 rounded-xl border bg-background px-3 text-sm"
            disabled={busy}
          />
          <Button type="submit" disabled={busy || !draft.trim()} aria-label="إرسال">
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
