// Push Notifications Utility

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    console.warn('This browser does not support notifications');
    return 'denied';
  }

  if (Notification.permission === 'granted') {
    return 'granted';
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission;
  }

  return Notification.permission;
}

export function showNotification(title: string, options?: NotificationOptions) {
  if (Notification.permission === 'granted') {
    const notification = new Notification(title, {
      icon: '/icon-192x192.png',
      badge: '/icon-192x192.png',
      ...options,
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
    };

    // Vibrate if supported
    if ('vibrate' in navigator) {
      navigator.vibrate([200, 100, 200]);
    }

    return notification;
  }
  return null;
}

export function notifyNewMessage(senderName: string, message: string, avatarUrl?: string) {
  showNotification(`New message from ${senderName}`, {
    body: message,
    icon: avatarUrl || '/icon-192x192.png',
    tag: 'new-message',
    requireInteraction: false,
  });
}

export function notifyFriendRequest(senderName: string, avatarUrl?: string) {
  showNotification('New friend request', {
    body: `${senderName} sent you a friend request`,
    icon: avatarUrl || '/icon-192x192.png',
    tag: 'friend-request',
  });
}

export function notifyIncomingCall(callerName: string, callType: 'audio' | 'video', avatarUrl?: string) {
  showNotification(`Incoming ${callType} call`, {
    body: `${callerName} is calling you`,
    icon: avatarUrl || '/icon-192x192.png',
    tag: 'incoming-call',
    requireInteraction: true,
  });
  
  // Vibrate for call
  if ('vibrate' in navigator) {
    navigator.vibrate([300, 100, 300, 100, 300]);
  }
}
