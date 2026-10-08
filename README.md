# Agrilink Mobile

Aplicativo Expo Router para Android e iOS.

## Instalação e verificações

Na pasta `mobileagri`, execute:

```bash
npm ci
npm run doctor
npm run check:expo-deps
npm run typecheck
```

Para iniciar o projeto localmente:

```bash
npm start
```

## Gerar APK Android

O APK de distribuição interna é compilado na nuvem pelo EAS Build; não é necessário ter Android Studio instalado localmente.

1. Entre na conta Expo vinculada ao projeto:

   ```bash
   npx eas-cli login
   ```

   Essa conta precisa ter acesso ao projeto EAS configurado no `app.json`.

2. Gere o APK:

   ```bash
   npm run build:apk
   ```

   O perfil `preview` produz um APK instalável e o EAS apresenta o link de download ao concluir. Para publicar na Google Play, gere o Android App Bundle do perfil de produção:

   ```bash
   npx eas-cli build --platform android --profile production
   ```

   O APK `preview` inclui ABIs ARM de 32 e 64 bits para reduzir o tamanho mantendo compatibilidade com telemóveis Android comuns. Não inclui emuladores/dispositivos x86; se precisar deles, ajuste `buildArchs` no plugin `expo-build-properties` em `app.json` e volte a compilar. O APK só pode ser instalado diretamente em dispositivos; o AAB de produção deve ser distribuído pela Google Play.

## Configuração de rede

O app usa o Supabase para autenticação e dados. Defina `EXPO_PUBLIC_SUPABASE_URL` e `EXPO_PUBLIC_SUPABASE_ANON_KEY` no `.env` para builds locais e no ambiente EAS `preview`/`production` para builds na nuvem. Sem esses valores, os recursos ligados ao Supabase não conseguirão conectar.

## Pontos Verdes

Os Pontos Verdes reúnem stock de vários produtores em locais físicos de levantamento e permitem reservar pequenas quantidades para o próprio dia ou para o dia seguinte. Nesta primeira versão, o pedido é reservado na app e pago no ponto durante o levantamento; o pagamento online não é usado para este fluxo.

Antes de ativar a funcionalidade, aplique no Supabase, por ordem, as migrações `20261008173000_install_admin_ads_and_dashboard.sql` e `20261008182000_green_points.sql` (além das migrações anteriores do projeto). Um administrador cria os pontos, cadastra produtos com stock e informa um preço de mercado superior ao preço do ponto. Os pedidos reservam o stock de forma atómica no banco de dados.

## Cadastro e códigos por e-mail

O cadastro recomenda a confirmação por e-mail e grava os dados do utilizador na tabela pública `users` depois da confirmação OTP. A tabela deve aceitar `id`, `full_name`, `phone`, `email`, `user_type` e `updated_at`, com `id` único e políticas RLS que permitam ao utilizador autenticado consultar, inserir e atualizar apenas o próprio registo. O esquema e as políticas pertencem ao projeto Supabase e não são criados pelo cliente mobile.

Para receber um código de seis dígitos, ative a confirmação por e-mail em **Authentication → Providers → Email** e configure o modelo **Confirm signup** para apresentar `{{ .Token }}`. O modelo padrão pode enviar um link de confirmação em vez de um código; nesse caso, o código nesta tela não corresponde ao e-mail. Para entrega fiável, configure também um fornecedor SMTP verificado no Supabase e confirme os limites de envio do fornecedor. O cliente mobile não consegue corrigir configuração de SMTP, filtros anti-spam ou modelos guardados no painel remoto.

## Idiomas

O idioma pode ser alterado em **Perfil → Definições**. As preferências disponíveis são Português (Angola) e Français (Congo) e são guardadas no dispositivo.
