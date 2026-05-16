declare module "google-trends-api" {
  type Opts = { keyword: string; geo?: string; startTime?: Date; endTime?: Date };
  const api: {
    relatedQueries: (o: Opts) => Promise<string>;
    interestOverTime: (o: Opts) => Promise<string>;
    dailyTrends: (o: { geo?: string; trendDate?: Date }) => Promise<string>;
  };
  export default api;
}

declare module "jsdom" {
  export class JSDOM {
    constructor(html: string, options?: { url?: string });
    window: { document: Document };
  }
}
