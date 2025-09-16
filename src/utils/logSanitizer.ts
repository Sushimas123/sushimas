// Utility to sanitize user input before logging
export const sanitizeForLog = (input: any): string => {
  if (input === null || input === undefined) {
    return 'null';
  }
  
  const str = String(input);
  // Remove newlines, carriage returns, and other control characters
  return str.replace(/[\r\n\t\x00-\x1f\x7f-\x9f]/g, '');
};

// Safe logging function that automatically sanitizes inputs
export const safeLog = (message: string, ...args: any[]) => {
  const sanitizedArgs = args.map(arg => 
    typeof arg === 'object' ? JSON.stringify(arg).replace(/[\r\n\t\x00-\x1f\x7f-\x9f]/g, '') : sanitizeForLog(arg)
  );
  console.log(sanitizeForLog(message), ...sanitizedArgs);
};