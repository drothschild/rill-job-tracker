import { escapeHtml } from '../helpers';

/**
 * Settings view data type
 */
export interface SettingsViewData {
  alert_threshold_days: number;
  alerts_enabled: string;
  gmail_user: string;
  gmail_app_password: string;
  alert_recipient_email: string;
  message?: string;
  messageType?: 'success' | 'error';
}

/**
 * Render the settings page with forms for alert and Gmail configuration
 */
export function settingsView(settings: SettingsViewData): string {
  const messageHtml = settings.message
    ? `<div class="p-4 rounded-lg mb-6 ${
        settings.messageType === 'success'
          ? 'bg-green-100 border border-green-400 text-green-700'
          : 'bg-red-100 border border-red-400 text-red-700'
      }">
      ${escapeHtml(settings.message)}
    </div>`
    : '';

  return `
    <div class="max-w-4xl mx-auto">
      ${messageHtml}

      <!-- Alert Settings Section -->
      <div class="bg-white rounded-lg shadow-sm p-6 mb-6 border border-gray-200">
        <h2 class="text-xl font-semibold text-gray-900 mb-4">Alert Configuration</h2>
        <form
          method="POST"
          action="/settings/alerts"
          hx-post="/settings/alerts"
          hx-target="closest form"
          hx-swap="outerHTML"
          class="space-y-4"
        >
          <div>
            <label for="alert_threshold_days" class="block text-sm font-medium text-gray-700 mb-1">
              Days Before No-Response Alert
            </label>
            <input
              type="number"
              id="alert_threshold_days"
              name="alert_threshold_days"
              value="${settings.alert_threshold_days}"
              min="1"
              max="365"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p class="mt-1 text-sm text-gray-500">Number of days of inactivity to trigger a no-response alert</p>
          </div>

          <div>
            <label class="flex items-center">
              <input
                type="checkbox"
                id="alerts_enabled"
                name="alerts_enabled"
                value="true"
                ${settings.alerts_enabled === 'true' ? 'checked' : ''}
                class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span class="ml-2 text-sm text-gray-700">Enable email alerts</span>
            </label>
            <p class="mt-1 text-sm text-gray-500">When enabled, the system will send email digests hourly</p>
          </div>

          <button
            type="submit"
            class="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            Save Alert Settings
          </button>
        </form>
      </div>

      <!-- Gmail Settings Section -->
      <div class="bg-white rounded-lg shadow-sm p-6 mb-6 border border-gray-200">
        <h2 class="text-xl font-semibold text-gray-900 mb-4">Gmail Configuration</h2>
        <p class="text-sm text-gray-600 mb-4">
          Use a
          <a
            href="https://support.google.com/accounts/answer/185833"
            target="_blank"
            rel="noopener noreferrer"
            class="text-blue-600 hover:underline"
          >
            Gmail App Password
          </a>
          for authentication. Regular Gmail passwords are not supported.
        </p>
        <form
          method="POST"
          action="/settings/gmail"
          hx-post="/settings/gmail"
          hx-target="closest form"
          hx-swap="outerHTML"
          class="space-y-4"
        >
          <div>
            <label for="gmail_user" class="block text-sm font-medium text-gray-700 mb-1">
              Gmail Email Address
            </label>
            <input
              type="email"
              id="gmail_user"
              name="gmail_user"
              value="${escapeHtml(settings.gmail_user)}"
              placeholder="your.email@gmail.com"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label for="gmail_app_password" class="block text-sm font-medium text-gray-700 mb-1">
              App Password
            </label>
            <input
              type="password"
              id="gmail_app_password"
              name="gmail_app_password"
              value="${escapeHtml(settings.gmail_app_password)}"
              placeholder="Enter your 16-character app password"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p class="mt-1 text-sm text-gray-500">Your password is stored securely in the database</p>
          </div>

          <div>
            <label for="alert_recipient_email" class="block text-sm font-medium text-gray-700 mb-1">
              Recipient Email Address
            </label>
            <input
              type="email"
              id="alert_recipient_email"
              name="alert_recipient_email"
              value="${escapeHtml(settings.alert_recipient_email)}"
              placeholder="email@example.com"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p class="mt-1 text-sm text-gray-500">Where to send alert digests (can be different from Gmail address)</p>
          </div>

          <button
            type="submit"
            class="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            Save Gmail Settings
          </button>
        </form>
      </div>

      <!-- Password Section -->
      <div class="bg-white rounded-lg shadow-sm p-6 mb-6 border border-gray-200">
        <h2 class="text-xl font-semibold text-gray-900 mb-4">Change Password</h2>
        <form method="POST" action="/auth/change-password" class="space-y-4">
          <div>
            <label for="current_password" class="block text-sm font-medium text-gray-700 mb-1">
              Current Password
            </label>
            <input
              type="password"
              id="current_password"
              name="current_password"
              required
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label for="new_password" class="block text-sm font-medium text-gray-700 mb-1">
              New Password
            </label>
            <input
              type="password"
              id="new_password"
              name="new_password"
              required
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label for="confirm_password" class="block text-sm font-medium text-gray-700 mb-1">
              Confirm New Password
            </label>
            <input
              type="password"
              id="confirm_password"
              name="confirm_password"
              required
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            type="submit"
            class="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            Change Password
          </button>
        </form>
      </div>

      <!-- Data Export Section -->
      <div class="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
        <h2 class="text-xl font-semibold text-gray-900 mb-4">Data Export</h2>
        <p class="text-sm text-gray-600 mb-4">Download all your job tracker data as JSON</p>
        <a
          href="/export"
          class="inline-block bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
        >
          Export Data
        </a>
      </div>
    </div>
  `;
}
