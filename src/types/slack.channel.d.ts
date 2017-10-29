declare namespace Slack {
  export interface Conversations {
    channels: Array<Channel>
    response_metadata: ResponseMetadata
  }

  export interface Channel {
    name: string
    id: string
  }

  export interface ResponseMetadata {
    next_cursor?: string
  }
}
