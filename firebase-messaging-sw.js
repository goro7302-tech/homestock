importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyAG9kyyfaky3vXtdS36zbzbAfvjQssUTtk",
  authDomain: "homestock-4a4f0.firebaseapp.com",
  projectId: "homestock-4a4f0",
  storageBucket: "homestock-4a4f0.firebasestorage.app",
  messagingSenderId: "377612858891",
  appId: "1:377612858891:web:975d5b70bf09034310790e"
});

const messaging = firebase.messaging();

// バックグラウンド通知の受信
messaging.onBackgroundMessage(payload => {
  const { title, body } = payload.notification;
  self.registration.showNotification(title, {
    body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: 'homestock-expiry',
    renotify: true,
  });
});
