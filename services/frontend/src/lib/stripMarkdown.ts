export function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]+`/g, '')
    .replace(/[#*>\-_\[\]()!]/g, '')
    .replace(/\n+/g, ' ')
    .trim();
}
