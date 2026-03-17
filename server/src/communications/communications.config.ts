interface HostingerSmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
  from: string;
}

interface QuoSmsConfig {
  baseUrl: string;
  apiKey: string;
  fromNumber: string;
  fromNumberId: string;
  userId: string;
}

const parsePort = (value: string | undefined): number | null => {
  if (!value) {
    return null;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseSecure = (value: string | undefined): boolean => {
  if (!value) {
    return true;
  }
  return value.toLowerCase() === 'true';
};

const hasValue = (value: string | undefined): value is string =>
  Boolean(value && value.trim().length > 0);

export const loadHostingerSmtpConfig = (): HostingerSmtpConfig | null => {
  const port = parsePort(process.env.SMTP_PORT);
  if (
    !hasValue(process.env.SMTP_HOST) ||
    port === null ||
    !hasValue(process.env.SMTP_USERNAME) ||
    !hasValue(process.env.SMTP_PASSWORD) ||
    !hasValue(process.env.SMTP_FROM)
  ) {
    return null;
  }
  return {
    host: process.env.SMTP_HOST.trim(),
    port,
    secure: parseSecure(process.env.SMTP_SECURE),
    username: process.env.SMTP_USERNAME.trim(),
    password: process.env.SMTP_PASSWORD.trim(),
    from: process.env.SMTP_FROM.trim(),
  };
};

export const loadQuoSmsConfig = (): QuoSmsConfig | null => {
  if (
    !hasValue(process.env.QUO_API_BASE_URL) ||
    !hasValue(process.env.QUO_API_KEY) ||
    !hasValue(process.env.QUO_FROM_NUMBER) ||
    !hasValue(process.env.QUO_FROM_NUMBER_ID) ||
    !hasValue(process.env.QUO_USER_ID)
  ) {
    return null;
  }
  return {
    baseUrl: process.env.QUO_API_BASE_URL.trim().replace(/\/+$/u, ''),
    apiKey: process.env.QUO_API_KEY.trim(),
    fromNumber: process.env.QUO_FROM_NUMBER.trim(),
    fromNumberId: process.env.QUO_FROM_NUMBER_ID.trim(),
    userId: process.env.QUO_USER_ID.trim(),
  };
};

export type { HostingerSmtpConfig, QuoSmsConfig };
