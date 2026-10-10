/** One or more problems with the user's config. Every message is meant to be shown verbatim. */
export class ConfigError extends Error {
  constructor(readonly problems: string[]) {
    super(problems.join('\n'));
    this.name = 'ConfigError';
  }
}
