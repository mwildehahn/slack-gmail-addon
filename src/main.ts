type GmailActionEvent = GoogleAppsScript.Gmail.GmailActionEvent

function buildFormCard(): Object {
  const card = CardService.newCardBuilder()
  card.setHeader(CardService.newCardHeader().setTitle("Send to Slack"))

  const section = CardService.newCardSection()

  const autoCompleteAction = CardService.newAction().setFunctionName(
    "handleAutoCompleteAction"
  )
  section.addWidget(
    CardService.newTextInput()
      .setFieldName("channel")
      .setTitle("Channel")
      .setSuggestionsAction(autoCompleteAction)
  )

  section.addWidget(
    CardService.newTextInput()
      .setFieldName("comment")
      .setMultiline(true)
      .setTitle("Comment")
  )

  const sendAction = CardService.newAction().setFunctionName("handleSendAction")
  section.addWidget(
    CardService.newTextButton()
      .setText("Send to Slack")
      .setOnClickAction(sendAction)
  )

  card.addSection(section)
  return card.build()
}

function buildSentCard(event: GmailActionEvent): Object {
  const formInput: App.FormInput = event.formInput
  const card = CardService.newCardBuilder()
  card.setHeader(
    CardService.newCardHeader().setTitle("Your message has been posted!")
  )

  const section = CardService.newCardSection()
  section.addWidget(
    CardService.newKeyValue()
      .setTopLabel("Channel")
      .setContent(formInput.channel)
  )

  if (formInput.comment) {
    section.addWidget(
      CardService.newKeyValue()
        .setTopLabel("Comment")
        .setContent(formInput.comment)
    )
  }

  const sendAgainAction = CardService.newAction().setFunctionName(
    "handleSendAgainAction"
  )
  section.addWidget(
    CardService.newTextButton()
      .setText("Send to another Channel")
      .setOnClickAction(sendAgainAction)
  )

  card.addSection(section)
  return card.build()
}

function handleSendToSlack(event: GmailActionEvent): Array<Object> {
  const card = buildFormCard()
  return CardService.newUniversalActionResponseBuilder()
    .displayAddOnCards([card])
    .build()
}

function handleSendAction(event: GmailActionEvent): Object {
  const card = buildSentCard(event)
  const nav = CardService.newNavigation()
    .popToRoot()
    .pushCard(card)

  return CardService.newActionResponseBuilder()
    .setNavigation(nav)
    .build()
}

function handleSendAgainAction(event: GmailActionEvent): Object {
  const card = buildFormCard()
  const nav = CardService.newNavigation()
    .popToRoot()
    .pushCard(card)

  return CardService.newActionResponseBuilder()
    .setNavigation(nav)
    .build()
}

function handleAutoCompleteAction(event: GmailActionEvent): Object {
  const names = getChannelNames()
  const input = ((event && event.formInput.channel) || "").toLowerCase()

  let suggestions: Array<string> = []
  names.forEach((name: string) => {
    if (name && name.indexOf(input) != -1) {
      suggestions.push(name)
    }
  })

  return CardService.newSuggestionsResponseBuilder()
    .setSuggestions(CardService.newSuggestions().addSuggestions(suggestions))
    .build()
}

function handleAuthCheck() {
  callApi("auth.test")
}

function handleAuth(request: any) {
  const service = getOAuthService()
  const isAuthorized = service.handleCallback(request)
  if (isAuthorized) {
    return HtmlService.createHtmlOutput("Success! You can close this tab.")
  }
  return HtmlService.createHtmlOutput("Denied. You can close this tab.")
}

function getChannelNames(): Array<string> {
  const channels = getChannels()
  return channels.map((channel: Slack.Channel) => channel.name)
}

function getChannels(): Array<Slack.Channel> {
  let conversations = getConversations()
  let channels = conversations.channels || []

  let nextCursor = getNextCursor(conversations)
  while (nextCursor) {
    conversations = getConversations(nextCursor)

    channels = channels.concat(conversations.channels || [])
    nextCursor = getNextCursor(conversations)
  }

  return channels
}

function getConversations(cursor?: string): Slack.Conversations {
  const payload = {
    exclude_archived: true,
    // don't support im & mpim right now since we are posting the message using the channel/group name for now
    types: "public_channel,private_channel",
    cursor: cursor || ""
  }

  return callApi("conversations.list", payload)
}

function getNextCursor(response: Slack.Conversations): string {
  return (
    (response.response_metadata && response.response_metadata.next_cursor) || ""
  )
}

function sendMessage(channel: string, email: string, comment?: string): void {
  const payload = {
    channel,
    text: comment || "",
    attachments: [
      {
        text: email
      }
    ]
  }

  return callApi("chat.postMessage", payload)
}

function callApi(method: string, data: any = {}): any {
  const service = getOAuthService()
  if (!service.hasAccess()) {
    throwAuthorizationError(service)
  }

  const properties = PropertiesService.getScriptProperties()
  const apiBase = properties.getProperty("SLACK_API_BASE_URL")

  const token = service.getAccessToken()
  const endpoint = `${apiBase}/${method}`
  data.token = token

  const options = {
    method: "post",
    payload: data
  }

  const response = UrlFetchApp.fetch(endpoint, options)
  if (response.getResponseCode() != 200) {
    console.error("Error calling API", response)
    throw new Error("Error calling API")
  }
  const content = response.getContentText()
  const json = JSON.parse(content)

  const authErrors = ["not_authed", "invalid_auth", "invalid_code"]
  if (!json.ok && authErrors.includes(json.error)) {
    throwAuthorizationError(service)
  } else if (!json.ok) {
    console.error("API call failed", json)
    throw new Error("API call failed")
  }

  return json
}

function throwAuthorizationError(service) {
  CardService.newAuthorizationException()
    .setAuthorizationUrl(service.getAuthorizationUrl())
    .setResourceDisplayName("Connect to Slack")
    .throwException()
}

function getOAuthService(): any {
  const properties = PropertiesService.getScriptProperties()

  const authorizationUrl = properties.getProperty(
    "SLACK_OAUTH_AUTHORIZATION_URL"
  )
  const tokenUrl = properties.getProperty("SLACK_OAUTH_TOKEN_URL")
  const clientId = properties.getProperty("SLACK_CLIENT_ID")
  const clientSecret = properties.getProperty("SLACK_CLIENT_SECRET")

  return OAuth2.createService("Slack")
    .setAuthorizationBaseUrl(authorizationUrl)
    .setTokenUrl(tokenUrl)
    .setClientId(clientId)
    .setClientSecret(clientSecret)
    .setCallbackFunction("handleAuth")
    .setCache(CacheService.getUserCache())
    .setScope("channels:read groups:read im:read mpim:read")
    .setPropertyStore(PropertiesService.getUserProperties())
}
