/**
 * VN: Helper chạy MỘT LẦN để lấy GOOGLE_DRIVE_REFRESH_TOKEN.
 *
 * Cách chạy:
 *   1) Đặt tạm GOOGLE_DRIVE_CLIENT_ID và GOOGLE_DRIVE_CLIENT_SECRET vào .env
 *      (hoặc export qua shell trước khi chạy).
 *   2) Từ thư mục apps/api chạy:
 *          pnpm exec ts-node scripts/drive-oauth-init.ts
 *   3) Script in ra 1 URL — mở trong browser, đăng nhập Google, ấn Allow.
 *   4) Google redirect về `http://localhost:53682/?code=...` — copy toàn bộ giá
 *      trị `code=...` (không bao gồm phần &scope=) rồi paste vào terminal.
 *   5) Script sẽ đổi code -> refresh_token và in ra. Dán refresh_token vào
 *      biến GOOGLE_DRIVE_REFRESH_TOKEN trong .env rồi restart API.
 *
 * Lưu ý bảo mật: KHÔNG commit refresh_token, KHÔNG log nó ra ngoài terminal của
 * người vận hành. Nếu lộ, thu hồi tại https://myaccount.google.com/permissions.
 */
import "dotenv/config";
import { createInterface } from "node:readline";
import { google } from "googleapis";

const REDIRECT_URI = "http://localhost:53682/";
const SCOPES = ["https://www.googleapis.com/auth/drive.file"];

async function main(): Promise<void> {
  const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    console.error(
      "Missing GOOGLE_DRIVE_CLIENT_ID / GOOGLE_DRIVE_CLIENT_SECRET in environment.",
    );
    process.exit(1);
  }

  const oauth2 = new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI);
  const url = oauth2.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
  });

  console.log("\n=== Google Drive OAuth init ===\n");
  console.log("1) Open the URL below in a browser you are logged into:\n");
  console.log(url);
  console.log(
    "\n2) After clicking Allow, Google will redirect to a URL like:",
  );
  console.log("     http://localhost:53682/?code=4/0A...&scope=...\n");
  console.log("3) Copy the value of the `code` query param and paste it here.\n");

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const rawInput: string = await new Promise((resolve) =>
    rl.question("Paste FULL URL hoặc chỉ code: ", (ans) => {
      rl.close();
      resolve(ans.trim());
    }),
  );
  if (!rawInput) {
    console.error("No input. Aborting.");
    process.exit(1);
  }
  // Tự tách code=... nếu user dán cả URL. Chấp nhận cả 2 dạng đầu vào.
  let code = rawInput;
  if (rawInput.includes("code=")) {
    const m = rawInput.match(/[?&]code=([^&]+)/);
    if (m) code = decodeURIComponent(m[1]);
  }
  console.log(`Using code prefix: ${code.slice(0, 10)}...`);

  const { tokens } = await oauth2.getToken(code);
  if (!tokens.refresh_token) {
    console.error(
      "Google did not return a refresh_token. Re-run and make sure the consent screen prompted you (delete the app from https://myaccount.google.com/permissions and try again).",
    );
    process.exit(1);
  }

  console.log("\nSUCCESS. Add this to your .env:\n");
  console.log(`GOOGLE_DRIVE_REFRESH_TOKEN=${tokens.refresh_token}`);
  console.log("\nThen restart the API.\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
