exports['Translate issue opened translates an issue 1'] = {
  "q": [
    "Não é possível utilizar juntamente com o Firestore no Android"
  ],
  "format": "text",
  "target": "en"
}

exports['Translate issue opened translates an issue 2'] = {
  "q": [
    "Tenho um app que utiliza da biblioteca do Firestore e também precisa utilizar a do DialogFlow, até o momento estou utilizando a [biblioteca V1](https://github.com/dialogflow/dialogflow-android-client) e não enfrento quaisquer problemas, porém, como a V1 do DialogFlow vai ser encerrada em breve, preciso migrar para a V2. Em minhas tentativas de utilizar esta biblioteca juntamente com o Firestore, enfrento problemas de duplicação de classes.\r\n\r\nO problema deve-se a que esta lib usa de  protobuf-java e a do firestore, protobuf-lite, ambas fornecem as mesmas classes com implementações diferentes\r\n\r\nJá verifiquei [esse](https://github.com/googleapis/google-cloud-java/issues/5608) tópico que fala sobre, mas implementando a solução sugerida \r\n\r\n`configurations.all {\r\n          exclude group:'com.google.api.grpc',module:'proto-google-common-protos'\r\n          exclude group: 'com.google.protobuf', module: 'protobuf-java'\r\n          exclude group: 'com.google.guava',module: 'guava-jdk5'\r\n      }`\r\n\r\nTenho o seguinte erro \r\n`Supertypes of the following classes cannot be resolved. Please make sure you have the required dependencies in the classpath:\r\n    class com.google.cloud.dialogflow.v2beta1.QueryInput, unresolved supertypes: com.google.protobuf.GeneratedMessageV3\r\n    class com.google.cloud.dialogflow.v2beta1.QueryInputOrBuilder, unresolved supertypes: com.google.protobuf.MessageOrBuilder\r\n    class com.google.cloud.dialogflow.v2beta1.TextInput, unresolved supertypes: com.google.protobuf.GeneratedMessageV3\r\n    class com.google.cloud.dialogflow.v2beta1.TextInputOrBuilder, unresolved supertypes: com.google.protobuf.MessageOrBuilder\r\n    class com.google.cloud.dialogflow.v2beta1.TextInput.Builder, unresolved supertypes: com.google.protobuf.GeneratedMessageV3.Builder\r\n    class com.google.cloud.dialogflow.v2beta1.QueryInput.Builder, unresolved supertypes: com.google.protobuf.GeneratedMessageV3.Builder\r\n    class com.google.cloud.dialogflow.v2beta1.DetectIntentResponse, unresolved supertypes: com.google.protobuf.GeneratedMessageV3\r\n    class com.google.cloud.dialogflow.v2beta1.DetectIntentResponseOrBuilder, unresolved supertypes: com.google.protobuf.MessageOrBuilder`\r\n\r\nExiste alguma solução para isso?"
  ],
  "format": "text",
  "target": "en"
}

exports['Translate issue opened translates an issue 3'] = {
  "body": "Translated title:\n\nTitle.\n\nTranslated body:\n\nBody"
}
