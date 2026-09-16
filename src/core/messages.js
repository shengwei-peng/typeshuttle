// Validates messages from the toolbar panel to the page. Anything malformed is ignored.

const MAX_TEXT_LENGTH = 5_000_000;
const MAX_BASE64_LENGTH = 30_000_000;
const MAX_FILE_NAME_LENGTH = 255;

const isString = (value, maxLength) => typeof value === 'string' && value.length <= maxLength;

const SCHEMAS = {
  'typeshuttle/status': () => ({}),
  'typeshuttle/send-direct': (message) => (
    isString(message.text, MAX_TEXT_LENGTH)
    && typeof message.sendTabKey === 'boolean'
    && ['enter', 'shift-enter'].includes(message.newlineKey)
      ? { text: message.text, sendTabKey: message.sendTabKey, newlineKey: message.newlineKey }
      : null
  ),
  'typeshuttle/send-precise': (message) => (
    isString(message.dataBase64, MAX_BASE64_LENGTH)
    && Number.isFinite(message.createdAt)
    && (message.fileName === null || isString(message.fileName, MAX_FILE_NAME_LENGTH))
      ? { dataBase64: message.dataBase64, createdAt: message.createdAt, fileName: message.fileName }
      : null
  ),
};

export function validateMessage(message) {
  const schema = SCHEMAS[message?.type];
  if (!schema) return null;
  const fields = schema(message);
  return fields ? { type: message.type, ...fields } : null;
}
