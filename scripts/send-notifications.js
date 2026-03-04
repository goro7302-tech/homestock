const admin = require('firebase-admin');

// サービスアカウントキーで初期化
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

const db = admin.firestore();
const messaging = admin.messaging();

async function sendExpiryNotifications() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const in1day = new Date(today); in1day.setDate(today.getDate() + 1);
  const in3days = new Date(today); in3days.setDate(today.getDate() + 3);

  const fmt = d => d.toISOString().split('T')[0];
  const todayStr   = fmt(today);
  const in1dayStr  = fmt(in1day);
  const in3daysStr = fmt(in3days);

  console.log(`チェック日: ${todayStr}, 1日後: ${in1dayStr}, 3日後: ${in3daysStr}`);

  // 全ユーザーを取得
  const usersSnap = await db.collection('users').get();
  let totalSent = 0;

  for (const userDoc of usersSnap.docs) {
    const userData = userDoc.data();
    const tokens = userData.fcmTokens || [];
    if (tokens.length === 0) continue;

    // そのユーザーのアイテムを取得
    const itemsSnap = await db.collection('users').doc(userDoc.id).collection('items').get();
    const expiringItems = [];

    for (const itemDoc of itemsSnap.docs) {
      const item = itemDoc.data();
      if (!item.expiryDate) continue;

      if (item.expiryDate === in1dayStr) {
        expiringItems.push({ name: item.name, days: 1 });
      } else if (item.expiryDate === in3daysStr) {
        expiringItems.push({ name: item.name, days: 3 });
      }
    }

    if (expiringItems.length === 0) continue;

    // 通知メッセージを作成
    const names = expiringItems.map(i => i.name).join('、');
    const minDays = Math.min(...expiringItems.map(i => i.days));
    const title = '🛒 HomeStock 消費期限アラート';
    const body = minDays === 1
      ? `${names} の消費期限は明日です！`
      : `${names} の消費期限まで${minDays}日です。`;

    // 無効なトークンを除外しながら送信
    const validTokens = [];
    for (const token of tokens) {
      try {
        await messaging.send({ token, notification: { title, body }, webpush: { notification: { icon: '/icon-192.png' } } });
        validTokens.push(token);
        totalSent++;
        console.log(`送信成功: ${userDoc.id} - ${body}`);
      } catch (e) {
        if (e.code === 'messaging/registration-token-not-registered') {
          console.log(`無効なトークンを削除: ${token.slice(0, 20)}...`);
          // 無効トークンをFirestoreから削除
          await db.collection('users').doc(userDoc.id).update({
            fcmTokens: admin.firestore.FieldValue.arrayRemove(token)
          });
        } else {
          validTokens.push(token);
          console.error(`送信エラー: ${e.message}`);
        }
      }
    }
  }

  console.log(`完了: ${totalSent}件の通知を送信`);
}

sendExpiryNotifications().catch(console.error);
