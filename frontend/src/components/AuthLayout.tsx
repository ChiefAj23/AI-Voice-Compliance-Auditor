import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { BellRing, ShieldCheck, Waves } from 'lucide-react';
import Logo from './Logo';

const highlights = [
  { icon: ShieldCheck, title: 'Policy checks on every call', text: 'Custom rules score each conversation the moment it is analyzed.' },
  { icon: Waves, title: 'Every signal in one view', text: 'Sentiment, emotion, toxicity and speaker turns side by side.' },
  { icon: BellRing, title: 'Follow-up built in', text: 'Alerts, scheduled reports and webhooks route risky calls to the right team.' },
];

interface AuthLayoutProps {
  title: string;
  description: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}

/** Split-screen shell for sign-in and registration. */
export default function AuthLayout({ title, description, children, footer }: AuthLayoutProps) {
  useEffect(() => {
    document.title = `${title} · Voice Compliance Auditor`;
  }, [title]);

  return (
    <div className="flex min-h-screen bg-surface">
      <div className="flex flex-1 flex-col px-6 py-8 sm:px-10 lg:flex-none lg:basis-[46%] lg:px-16">
        <div className="flex items-center gap-2.5">
          <Logo className="h-8 w-8" />
          <span className="text-[15px] font-semibold tracking-tight text-fg">Voice Auditor</span>
        </div>

        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12">
          <h1 className="text-2xl font-semibold tracking-tight text-fg">{title}</h1>
          <p className="mt-2 text-sm text-fg-subtle">{description}</p>
          <div className="mt-8">{children}</div>
          {footer && <div className="mt-8 text-sm text-fg-subtle">{footer}</div>}
        </div>

        <p className="text-xs text-fg-faint">
          © {new Date().getFullYear()} Voice Compliance Auditor · Built by Abhijeet Solanki
        </p>
      </div>

      <div className="relative hidden flex-1 overflow-hidden bg-[#0b1120] lg:flex">
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-[0.07] [background-image:linear-gradient(to_right,#fff_1px,transparent_1px),linear-gradient(to_bottom,#fff_1px,transparent_1px)] [background-size:40px_40px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]"
        />
        <div className="relative m-auto max-w-md px-12">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#9fb5fb]">Voice Compliance Auditor</p>
          <h2 className="mt-4 text-3xl font-semibold leading-tight tracking-tight text-white">
            Every customer call, reviewed for compliance.
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-white/60">
            Transcribe recordings, score them against your policies and route the risky ones to reviewers automatically.
          </p>
          <ul className="mt-10 space-y-6">
            {highlights.map(({ icon: Icon, title: itemTitle, text }) => (
              <li key={itemTitle} className="flex gap-4">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/5 text-[#9fb5fb]">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm font-medium text-white">{itemTitle}</p>
                  <p className="mt-0.5 text-sm text-white/55">{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
