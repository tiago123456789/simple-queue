# Fila Simples

Um sistema de fila de mensagens confiável e fácil de usar construído no Cloudflare Workers. Alternativa de código aberto a serviços pagos como Zeplo ou Qstash.

A fila para pessoas que só sabem o que é API e como fazer solicitações

Leia em [Inglês](README.md)

## Por Que Escolher a Fila Simples?

- Configure uma vez
- Escala com suas necessidades sem alterar configurações
- Pague apenas pelo que usa
- Você precisa apenas saber o que é uma API e como fazer solicitações HTTP
- Você precisa executar automações ou ações que levam muito tempo, e ao mesmo tempo limitar ações para evitar sobrecarregar seu servidor.

Imagine enviar mensagens entre seus apps sem se preocupar com elas se perderem ou seus sistemas travarem. A Fila Simples torna isso simples e acessível!

### Benefícios Principais:

- **Configuração Fácil**: Configure uma vez e esqueça. Nenhuma configuração complexa de servidor necessária.
- **Pague Apenas pelo que Usa**: Tecnologia serverless significa que você paga apenas pelo uso real – economize dinheiro!
- **Entrega Confiável**: Mensagens são armazenadas com segurança e entregues mesmo se seus apps estiverem ocupados ou offline.
- **Tentativas Automáticas**: Se algo der errado, tenta novamente automaticamente.
- **Organize Suas Mensagens**: Agrupe mensagens por app ou tarefa para manter tudo organizado.
- **Não Precisa de Especialistas Técnicos**: Funciona com solicitações HTTP simples – se você conhece APIs, está pronto.
- **Econômico**: Não precisa de equipes caras de DevOps ou infraestrutura.
- **Seguro**: Proteja suas mensagens com chaves de API.

## Como Funciona

1. **Envie Mensagens**: Seu app envia mensagens via solicitações HTTP simples.
2. **Armazene com Segurança**: Mensagens são armazenadas em uma fila confiável.
3. **Processe Automaticamente**: Um agendador pega as mensagens e as envia para seus apps de destino.
4. **Trate Erros**: Se a entrega falhar, tenta novamente ou move para uma fila de "carta morta" para revisão.

## Início Rápido

1. **Clone o Projeto**: Baixe o código do GitHub.
2. **Instale Dependências**: Execute `npm install`.
3. **Execute Localmente**: Use `npm run dev` para testar em sua máquina.
4. **Implante**: Execute `npm run deploy` para colocar em produção no Cloudflare.
5. **Configure o Agendador**: Use Supabase para criar um trabalho cron simples que processa mensagens a cada poucos segundos.

Para configuração detalhada, verifique a [documentação completa](#como-executar) abaixo.

## Recursos

- **Publicação de Mensagens**: Envie mensagens para a fila facilmente.
- **Processamento Automático**: Trata da entrega em segundo plano.
- **Mecanismo de Tentativa**: Continua tentando se as coisas não funcionarem na primeira vez.
- **Fila de Carta Morta**: Mensagens falhadas vão para aqui para revisão manual.
- **Prevenção de Duplicatas**: Evita enviar a mesma mensagem duas vezes.
- **Organização por Grupos**: Separe mensagens por app ou tarefa.
- **Validação de Dados**: Garante que as mensagens correspondam aos formatos esperados.
- **Atraso na Entrega**: Agende mensagens para serem entregues após um período específico.

Abra o arquivo groups.json.
Adicione um novo nome à lista. (Use nomes simples sem caracteres especiais, como user_queue, product_queue, chatbot_queue.)

### COMO PUBLICAR UMA MENSAGEM NO GRUPO PADRÃO

```bash
curl --request POST \
  --url 'URL_DA_FILA_SIMPLES_AQUI/publish?url=URL_RECEBER_MENSAGEM' \
  --header 'Content-Type: application/json' \
  --header 'User-Agent: insomnia/11.0.2' \
  --header 'x-api-key: sua_chave_api_aqui' \
  --data '{
	"message": "Olá teste, como você está",
	"timestamp": "1780776976949",
	"test": true
}'
```

### COMO PUBLICAR UMA MENSAGEM EM UM GRUPO PERSONALIZADO

```bash
curl --request POST \
  --url 'URL_DA_FILA_SIMPLES_AQUI/publish?groupId=ID_DO_GRUPO_DO_ARQUIVO_GROUPS.JSON&url=URL_RECEBER_MENSAGEM' \
  --header 'Content-Type: application/json' \
  --header 'User-Agent: insomnia/11.0.2' \
  --header 'x-api-key: sua_chave_api_aqui' \
  --data '{
	"message": "Olá teste, como você está",
	"timestamp": "1780776976949",
	"test": true
}'
```

### COMO DEFINIR ATRASO NA ENTREGA DA MENSAGEM

Você pode atrasar a entrega de mensagens usando o parâmetro de consulta `delay`. A mensagem só será processada após o atraso especificado ter passado.

**Importante:** Se você não especificar um atraso, a mensagem será processada imediatamente (sem espera).

**Formatos suportados:**
- `Xs` - segundos (ex.: `30s`)
- `Xm` - minutos (ex.: `1m`, `30m`)
- `Xh` - horas (ex.: `1h`)
- `0s`, `0m`, `0h` - entrega imediata (mesmo que não definir atraso)

**Atraso máximo:** 24 horas

**Exemplo - Atrasar mensagem em 1 minuto:**

```bash
curl --request POST \
  --url 'URL_DA_FILA_SIMPLES_AQUI/publish?url=URL_RECEBER_MENSAGEM&delay=1m' \
  --header 'Content-Type: application/json' \
  --header 'x-api-key: sua_chave_api_aqui' \
  --data '{
	"message": "Olá teste, atrasado em 1 minuto"
}'
```

**Exemplo - Atrasar mensagem em 30 segundos em um grupo personalizado:**

```bash
curl --request POST \
  --url 'URL_DA_FILA_SIMPLES_AQUI/publish?groupId=meugrupo&url=URL_RECEBER_MENSAGEM&delay=30s' \
  --header 'Content-Type: application/json' \
  --header 'x-api-key: sua_chave_api_aqui' \
  --data '{
	"message": "Olá teste, atrasado em 30 segundos"
}'
```

**Respostas de erro:**
- `400 Bad Request` - `"Formato de atraso inválido. Formatos válidos: 1s, 30s, 1m, 30m, 1h"`
- `400 Bad Request` - `"O atraso máximo é de 24 horas"`

## Visão Geral da Arquitetura

![Arquitetura](./architecture.png)

## Desempenho e Custos

- **Custo Baixo**: Processar 1 milhão de mensagens custa cerca de $5.
  - 1 milhão de Cloudflare Workers para publicar: $0.33
  - 1 milhão de Cloudflare Workers para consumir as mensagens: $0.33
  - 1 milhão de Cloudflare Durable Objects armazenamento para os dados da fila: $2
  - 1 milhão de Cloudflare Durable Objects obter e deletar os dados da fila: $2 (atualizar registro ao consumir a mensagem e operação de exclusão quando a mensagem for processada com sucesso)
- **Escalável**: Cresce com suas necessidades sem configuração extra.

## Obtenha Ajuda

Precisa de assistência? Estamos aqui para ajudar!

Email: [tiagorosadacost@gmail.com](mailto:tiagorosadacost@gmail.com)

---

## Detalhes Técnicos (Para Desenvolvedores)

### Tecnologias Usadas

- Cloudflare Workers
- Durable Objects (armazenamento SQLite)
- Node.js & TypeScript
- Supabase (para agendamento)

### Instruções Completas de Configuração

- Clone o repositório
- Execute `npm install`
- Execute `npm run dev` para desenvolvimento local
- Execute `npm run deploy` para implantar no Cloudflare Workers
- Importe a coleção Insomnia `Insomnia_2026-01-11.yaml` para testes

### Configurando Grupos

Edite `groups.json` para adicionar novos grupos (ex.: user_queue, product_queue).

### Validação de Dados

Use [esta ferramenta](https://transform.tools/json-to-zod) para gerar esquemas de validação e adicioná-los a `src/schemas-validation.ts`.

### Configuração do Agendador

Crie uma conta Supabase e configure um trabalho cron:

```sql
select net.http_get(
    url:='YOUR_QUEUE_URL/process',
    headers:=jsonb_build_object('x-api-key', 'YOUR_API_KEY'),
    timeout_milliseconds:=60000
);
```

### Variáveis de Ambiente

- `API_KEY`: Protege sua aplicação
- `HTTP_REQUEST_TIMEOUT`: Tempo limite de solicitação em segundos
- `TOTAL_RETRIES_BEFORE_DQL`: Tentativas de repetição antes da carta morta
- `TOTAL_MESSAGES_PULL_PER_TIME`: Mensagens processadas por lote
- `ENABLE_CONTROL_CONCURRENCY`: Ativar/desativar controle de concorrência baseado em consumidores (padrão: false)
- `LIMIT_CONSUMER_PROCESS`: Tempo de expiração do consumidor em minutos ao usar controle de concorrência (padrão: 15)

### Limitações (Plano Gratuito)

- Limite de memória de 128MB
- 1.000 solicitações/minuto
- 100.000 gravações/dia

### Resultados de Teste de Carga

Encontre scripts na pasta `loadtest/`. Desempenho de exemplo:

- 3k solicitações em 14.35s
- Latência média: 568ms
- Até 1.188 req/seg

---

## Controle de Concorrência Baseado em Consumidores

Um recurso poderoso que lhe dá controle preciso sobre quantas mensagens são processadas simultaneamente. Perfeito para limitar taxa de APIs de terceiros sensíveis ou prevenir sobrecarga do servidor.

### Por Que Usar Este Recurso?

- **Proteção de Limite de Taxa**: Previne sobrecarregar APIs de terceiros ou serviços downstream
- **Distribuição Justa**: Mensagens são processadas uniformemente em seu pool de consumidores
- **Recuperação Automática**: Consumidores expirados são automaticamente resetados para evitar mensagens travadas
- **Sem Espera**: Solicitações são enviadas sem esperar resposta (fire-and-forget), melhorando a taxa de transferência
- **Visibilidade**: Acompanhe o status do consumidor (WAITING, WORKING) em tempo real via painel

### Como Funciona

1. **Crie Consumidores**: Registre instâncias de consumidores que processarão mensagens
2. **Processe Mensagens**: Cada mensagem é atribuída a um consumidor WAITING
3. **Fire-and-Forget**: Solicitações são enviadas imediatamente sem esperar resposta
4. **Notifique Conclusão**: Apps de terceiros chamam um endpoint quando terminarem o processamento
5. **Reset Automático**: Consumidores expiram após um tempo limite para lidar com processamento abandonado

### Arquitetura

```
┌─────────────────────────────────────────────────────────────────┐
│                    Agendador Externo                             │
│               (chama /process a cada 5 segundos)                │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                   GET /process?groupId=X                         │
│           (somente se ENABLE_CONTROL_CONCURRENCY=true)           │
└───────────────────────────────┬─────────────────────────────────┘
                                │
         ┌──────────────────────┼──────────────────────┐
         ▼                      ▼                      ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│   Consumer-1    │  │   Consumer-2    │  │   Consumer-N    │
│   (WAITING)    │  │   (WORKING)     │  │   (WAITING)    │
│                 │  │  expira em 15m  │  │                 │
└────────┬────────┘  └────────┬────────┘  └────────┬────────┘
         │                    │                    │
         └────────────────────┼────────────────────┘
                              │
                              ▼
                    Processamento de Mensagem
                    + Header: consumer-id: <uuid>
```

### Ativando o Recurso

Defina a variável de ambiente em `wrangler.jsonc`:

```jsonc
"vars": {
  "ENABLE_CONTROL_CONCURRENCY": true,
  "LIMIT_CONSUMER_PROCESS": 15
}
```

### Criando Consumidores

Navegue até o painel ou use a API para criar consumidores:

```bash
# Via painel: GET /consumers?x-api-key=SUA_CHAVE
# Selecione grupo, insira quantidade, clique em Criar

# Via API
curl --request POST \
  --url 'URL_FILA_SIMPLES/consumers?x-api-key=sua_chave_api_aqui' \
  --header 'Content-Type: application/json' \
  --data '{"groupId": "DEFAULT", "count": 5}'
```

### Processando Mensagens

Quando consumidores estão disponíveis, mensagens são enviadas com os headers `consumer-id` e `group-id`:

```bash
# Terceiro recebe solicitação com:
# Header: consumer-id: 550e8400-e29b-41d4-a716-446655440000
# Header: group-id: DEFAULT
# Header: x-api-key: sua_chave_api_aqui
# Body: { ...seu payload... }
```

Seu aplicativo deve usar o header `consumer-id` para notificar conclusão quando terminar o processamento.

### Notificando Conclusão

Após processar, seu aplicativo notifica a fila:

```bash
curl --request POST \
  --url 'URL_FILA_SIMPLES/consumer-is-ready-process-next-message?groupId=DEFAULT' \
  --header 'Content-Type: application/json' \
  --data '{"consumerId": "550e8400-e29b-41d4-a716-446655440000"}'
```

### Resetando Consumidores Expirados

Se um consumidor expirar (estava processando por tempo demais), reset eles:

```bash
curl --request GET \
  --url 'URL_FILA_SIMPLES/reset-consumers?groupIds=DEFAULT,queue1&x-api-key=sua_chave_api_aqui'
```

### Configurando o Agendador de Reset

Crie um segundo trabalho cron do Supabase para resetar automaticamente consumidores expirados:

- Crie um novo trabalho cron
- Adicione um nome (ex.: "Reset Consumidores Expirados")
- Defina o agendamento para executar a cada 30 segundos (ou seu intervalo preferido)
- Tipo **SQL Snippet**
- SQL snippet para todos os grupos:

```sql
select
net.http_get(
    url:='URL_DA_SUA_APLICACAO/reset-consumers?groupIds=DEFAULT,queue1,queue2',
    headers:=jsonb_build_object('x-api-key', 'SUA_API_KEY'),
    timeout_milliseconds:=60000
);
```

**Nota:** Ajuste `groupIds` para corresponder aos seus grupos configurados em `groups.json`.

### Gerenciando Consumidores via Painel

Acesse a página de gerenciamento de consumidores:

```
GET /consumers?x-api-key=sua_chave_api_aqui
```

Recursos:
- Ver todos os consumidores (WAITING, WORKING, EXPIRED)
- Filtrar por grupo
- Deletar consumidores WAITING
- Criar novos consumidores
- Monitorar tempos de expiração

### Status do Consumidor

| Status | Descrição |
|--------|-------------|
| `WAITING` | Pronto para processar mensagens |
| `WORKING` | Processando uma mensagem atualmente |
| `EXPIRED` | Expirou enquanto trabalhava (precisa de reset) |

### Resumo de Benefícios

| Benefício | Descrição |
|-----------|-------------|
| **Controle Preciso** | Limite o processamento simultâneo a números exatos |
| **Sem Gargalos** | Fire-and-forget não espera respostas |
| **Auto-Recuperação** | Consumidores expirados são automaticamente resetados |
| **Visibilidade** | Status em tempo real via painel |
| **Escalabilidade** | Adicione mais consumidores a qualquer momento |
| **Flexibilidade** | Limites diferentes por grupo |
