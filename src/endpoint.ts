export type EndpointConfig = Record<string, string>;

/** Central registry for grouping endpoint URLs by service name. */
export class Endpoint {
  private static registered: Record<string, EndpointConfig> = {};

  static register(serviceOrConfigs: string | Record<string, EndpointConfig>, endpoints?: EndpointConfig) {
    if (typeof serviceOrConfigs === "string") {
      this.registered[serviceOrConfigs] = { ...endpoints! };
    } else {
      for (const [service, config] of Object.entries(serviceOrConfigs)) {
        this.registered[service] = { ...config };
      }
    }
    return this;
  }

  static all() {
    return { ...this.registered };
  }
}
