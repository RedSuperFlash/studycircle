import {
  useId,
  type ReactNode,
  type ButtonHTMLAttributes,
  type FormEvent,
  type InputHTMLAttributes,
} from 'react';
import {
  ArrowRight,
  Inbox,
  TriangleAlert,
  CheckCircle2,
  BookOpen,
  Sigma,
  Plane,
  Atom,
  Code2,
  Microscope,
  FlaskConical,
  Calculator,
  MapPin,
  GraduationCap,
} from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import katex from 'katex';
import type { Row } from '../types';
import { useRPC, useRows } from '../hooks/workspace';
export const icons: Record<string, typeof Inbox> = {
  linear: Sigma,
  math: Calculator,
  aero: Plane,
  physics: Atom,
  cs: Code2,
  programming: Code2,
  bio: Microscope,
  chemistry: FlaskConical,
  bengaluru: MapPin,
  exams: GraduationCap,
};
export function SubjectIcon({ subject, size = 19 }: { subject?: string; size?: number }) {
  const Icon = icons[subject || ''] || BookOpen;
  return (
    <span className={'subject-icon tone-' + (subject || 'exams')}>
      <Icon size={size} />
    </span>
  );
}
export function Logo() {
  return (
    <span className="brand">
      <img src={import.meta.env.BASE_URL + 'icon.svg'} alt="" width="37" height="37" />
      <strong>
        Study<span>Circle</span>
      </strong>
    </span>
  );
}
export function Button({
  children,
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className={'button ' + className} {...props}>
      {children}
    </button>
  );
}
export function ButtonLink({
  to,
  children,
  primary = false,
}: {
  to: string;
  children: ReactNode;
  primary?: boolean;
}) {
  return (
    <Link className={'button ' + (primary ? 'primary' : '')} to={to}>
      {children}
    </Link>
  );
}
export function Section({
  title,
  action,
  children,
  className = '',
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={'panel ' + className}>
      <div className="panel-head">
        <h2>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
export function PageTitle({
  title,
  detail,
  action,
}: {
  title: string;
  detail: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-title">
      <div>
        <h1>{title}</h1>
        <p>{detail}</p>
      </div>
      {action}
    </div>
  );
}
export function Empty({
  title,
  detail,
  icon: Icon = Inbox,
}: {
  title: string;
  detail?: string;
  icon?: typeof Inbox;
}) {
  return (
    <div className="empty">
      <span>
        <Icon size={22} />
      </span>
      <strong>{title}</strong>
      {detail && <p>{detail}</p>}
    </div>
  );
}
export function QueryState({ loading, error }: { loading?: boolean; error?: string }) {
  if (error)
    return (
      <p className="feedback error" role="alert">
        <TriangleAlert size={16} />
        {error}
      </p>
    );
  if (loading)
    return (
      <div className="skeleton-group" role="status" aria-label="Loading">
        <i />
        <i />
        <i />
      </div>
    );
  return null;
}
export function Feedback({ error, notice }: { error?: string; notice?: string }) {
  return error ? (
    <p className="feedback error" role="alert">
      <TriangleAlert size={17} />
      {error}
    </p>
  ) : notice ? (
    <p className="feedback success" role="status">
      <CheckCircle2 size={17} />
      {notice}
    </p>
  ) : null;
}
export function TextLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link className="text-link" to={to}>
      {children}
      <ArrowRight size={15} />
    </Link>
  );
}
export function Tabs({ labels, label = 'Views' }: { labels: string[]; label?: string }) {
  const [params, set] = useSearchParams();
  const current = params.get('tab');
  const tab = labels.includes(current || '') ? current : labels[0];
  return (
    <nav aria-label={label} className="tabs">
      {labels.map((item) => (
        <button
          key={item}
          aria-current={item === tab ? 'page' : undefined}
          onClick={() => set({ tab: item })}
        >
          {item}
        </button>
      ))}
    </nav>
  );
}
export function Field({
  label,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input {...props} />
    </label>
  );
}
export function Area({
  label,
  name,
  required = false,
  defaultValue,
  placeholder,
  maxLength = 7000,
}: {
  label: string;
  name: string;
  required?: boolean;
  defaultValue?: string;
  placeholder?: string;
  maxLength?: number;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <textarea
        name={name}
        required={required}
        defaultValue={defaultValue}
        placeholder={placeholder}
        maxLength={maxLength}
      />
    </label>
  );
}
export function Select({
  label,
  name,
  options,
  defaultValue,
  value,
  onChange,
  placeholder,
  required = false,
}: {
  label: string;
  name?: string;
  options: (string | { value: string; label: string })[];
  defaultValue?: string;
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  const id = useId();
  return (
    <label className="field" htmlFor={id}>
      <span id={id + '-label'}>{label}</span>
      <select
        id={id}
        aria-labelledby={id + '-label'}
        name={name}
        defaultValue={defaultValue}
        value={value}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        required={required}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) =>
          typeof o === 'string' ? (
            <option key={o}>{o}</option>
          ) : (
            <option value={o.value} key={o.value}>
              {o.label}
            </option>
          ),
        )}
      </select>
    </label>
  );
}
export const optionsFrom = (items: Row[]) => items.map((r) => ({ value: r.id!, label: r.name }));
export function SubjectSelect({
  required = true,
  value,
  onChange,
  defaultValue,
}: {
  required?: boolean;
  value?: string;
  onChange?: (v: string) => void;
  defaultValue?: string;
}) {
  const { data } = useRows('subjects', { order: 'name' });
  return (
    <Select
      name="subject"
      label="Subject"
      options={optionsFrom(data)}
      placeholder={required ? 'Select a subject' : 'Any subject'}
      value={value}
      onChange={onChange}
      defaultValue={defaultValue}
      required={required}
    />
  );
}
export function Form({
  children,
  onSubmit,
  className = '',
  reset = true,
}: {
  children: ReactNode;
  onSubmit: (data: FormData) => Promise<boolean> | void;
  className?: string;
  reset?: boolean;
}) {
  return (
    <form
      className={'form ' + className}
      onSubmit={async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const form = event.currentTarget;
        const ok = await onSubmit(new FormData(form));
        if (ok && reset) form.reset();
      }}
    >
      {children}
    </form>
  );
}
export function Check({
  name,
  children,
  defaultChecked = false,
  required = false,
}: {
  name: string;
  children: ReactNode;
  defaultChecked?: boolean;
  required?: boolean;
}) {
  return (
    <label className="check">
      <input name={name} type="checkbox" defaultChecked={defaultChecked} required={required} />
      <span>{children}</span>
    </label>
  );
}
export const field = (d: FormData, name: string) => String(d.get(name) || '').trim();
export const optional = (d: FormData, name: string) => field(d, name) || null;
export const fileFrom = (d: FormData, name: string) => {
  const f = d.get(name);
  return f instanceof File && f.size ? f : null;
};
export function Avatar({
  name = 'Student',
  tone = 'iris',
  size = '',
}: {
  name?: string;
  tone?: string;
  size?: string;
}) {
  return (
    <span className={'avatar avatar-' + tone + ' ' + size} aria-hidden="true">
      {name
        .split(/[ -]/)
        .slice(0, 2)
        .map((s) => s[0] || '')
        .join('')
        .toUpperCase() || 'S'}
    </span>
  );
}
export function Person({ id }: { id?: string | null }) {
  if (!id) return <span>Anonymous student</span>;
  return <NamedPerson id={id} />;
}
function NamedPerson({ id }: { id: string }) {
  const { data } = useRPC<Row[]>('person', { person_id: id }, []);
  return <span>{data[0]?.name || 'StudyCircle member'}</span>;
}
export function RichText({ text }: { text: string }) {
  const tokens = text.split(/(```[\s\S]*?```|\$\$[\s\S]*?\$\$|\$[^\n$]+\$)/g);
  return (
    <div className="rich-text">
      {tokens.map((token, i) => {
        if (token.startsWith('```') && token.endsWith('```'))
          return (
            <pre key={i}>
              <code>{token.slice(3, -3).replace(/^\w+\n/, '')}</code>
            </pre>
          );
        if (/^\$[\s\S]+\$$/.test(token)) {
          const display = token.startsWith('$$');
          const trim = display ? 2 : 1;
          const html = katex.renderToString(token.slice(trim, -trim), {
            displayMode: display,
            throwOnError: false,
            trust: false,
            maxExpand: 250,
            maxSize: 10,
          });
          return <span key={i} dangerouslySetInnerHTML={{ __html: html }} />;
        }
        return <span key={i}>{token}</span>;
      })}
    </div>
  );
}
export function Disclosure({ label, children }: { label: string; children: ReactNode }) {
  const id = useId();
  return (
    <details className="disclosure">
      <summary aria-controls={id}>{label}</summary>
      <div id={id}>{children}</div>
    </details>
  );
}
export function downloadJSON(data: unknown, name: string) {
  const href = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
  );
  const link = document.createElement('a');
  link.href = href;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}
