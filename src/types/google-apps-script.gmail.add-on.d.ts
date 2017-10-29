declare namespace GoogleAppsScript {
  export namespace Gmail {
    export interface GmailActionEvent {
      messageMetadata: GmailActionEventMessageMetaData
      formInput: any
      clientPlatform: string
      formInputs: any
      parameters: Object
    }

    export interface GmailActionEventMessageMetaData {
      accessToken: string
      messageId: string
    }
  }
}
