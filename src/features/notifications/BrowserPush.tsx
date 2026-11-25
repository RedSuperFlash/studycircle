import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { Button, Feedback } from '../../components/ui';
import { useAction, useWorkspace } from '../../hooks/workspace';

const publicKey = import.meta.env.VITE_WEB_PUSH_PUBLIC_KEY;
function keyBytes(key: string) {
  const padded = key.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (key.length % 4)) % 4);
  return Uint8Array.from(atob(padded), (letter) => letter.charCodeAt(0));
}

export function BrowserPush() {
  const { db, demo } = useWorkspace();
  const action = useAction();
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const supported =
    import.meta.env.PROD &&
    Boolean(publicKey) &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window &&
    !demo;
  useEffect(() => {
    if (!supported) return;
    let ignore = false;
    void navigator.serviceWorker
      .getRegistration()
      .then((reg) => reg?.pushManager.getSubscription())
      .then((value) => {
        if (!ignore) setSubscription(value ?? null);
      })
      .catch(console.warn);
    return () => {
      ignore = true;
    };
  }, [supported]);
  if (!supported) return null;
  const toggle = () =>
    action.run(
      async () => {
        if (subscription) {
          await db.rpc('manage_push_subscription', { device_endpoint: subscription.endpoint });
          await subscription.unsubscribe();
          setSubscription(null);
          return;
        }
        const permission = await Notification.requestPermission();
        if (permission !== 'granted')
          throw new Error('Allow notifications in your browser settings first.');
        const registered = await navigator.serviceWorker.getRegistration();
        if (!registered?.active)
          throw new Error('Reload once so StudyCircle can finish registering its service worker.');
        const active = await registered.pushManager.getSubscription();
        const created =
          active ||
          (await registered.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: keyBytes(publicKey),
          }));
        const { keys } = created.toJSON();
        try {
          await db.rpc('manage_push_subscription', {
            device_endpoint: created.endpoint,
            device_public_key: keys?.p256dh,
            device_auth: keys?.auth,
          });
        } catch (error) {
          if (!active) await created.unsubscribe();
          throw error;
        }
        setSubscription(created);
      },
      subscription
        ? 'Browser push disabled on this device.'
        : 'Browser push enabled on this device.',
    );
  return (
    <div className="push-control">
      <p className="muted">
        Browser alerts use a generic notification without study or message details.
      </p>
      <Button disabled={action.busy} onClick={() => void toggle()}>
        <Bell size={16} />
        {subscription ? 'Disable browser push' : 'Enable browser push'}
      </Button>
      <Feedback {...action} />
    </div>
  );
}
