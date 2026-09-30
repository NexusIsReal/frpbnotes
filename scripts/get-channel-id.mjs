// Prints the numeric chat ID of a Telegram channel your bot administers.
// Usage: node scripts/get-channel-id.mjs <BOT_TOKEN>
// Then post anything in the channel (or forward a channel message to the bot).

const token = process.argv[2] || process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error("Usage: node scripts/get-channel-id.mjs <BOT_TOKEN>");
  process.exit(1);
}

const api = (method) => `https://api.telegram.org/bot${token}/${method}`;

const me = await (await fetch(api("getMe"))).json();
if (!me.ok) {
  console.error("Invalid bot token:", me.description);
  process.exit(1);
}
console.log(`Connected as bot: @${me.result.username}\n`);

// A set webhook blocks getUpdates, so clear it first.
await fetch(api("deleteWebhook"));

console.log("Waiting for a channel event...");
console.log("Post anything in your channel now (or forward a message from the channel to the bot).\n");

for (let i = 0; i < 6; i++) {
  const res = await (await fetch(api("getUpdates?timeout=10"))).json();
  if (!res.ok) {
    console.error("getUpdates failed:", res.description);
    process.exit(1);
  }
  for (const update of res.result ?? []) {
    // Direct channel post (bot is channel admin) ...
    const post = update.channel_post ?? update.edited_channel_post;
    // ... or a message forwarded to the bot from the channel.
    const chat = post?.chat ?? update.message?.forward_from_chat;
    if (chat && chat.type === "channel") {
      console.log("Channel found!");
      console.log(`  Title:        ${chat.title}`);
      console.log(`  CHANNEL_ID:   ${chat.id}`);
      console.log("\nSet TELEGRAM_CHANNEL_ID to the value above.");
      process.exit(0);
    }
  }
}

console.log("No channel event detected. Checklist:");
console.log("  1. The bot was added as an ADMIN of the channel (post messages permission).");
console.log("  2. You posted a NEW message in the channel while this script was running.");
console.log("  3. Re-run: node scripts/get-channel-id.mjs <BOT_TOKEN>");
