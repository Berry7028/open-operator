# Open Operator

> [!WARNING]
> This is simply a proof of concept.
> This project uses Stagehand for AI-powered web automation. Stagehand is an open source web agent framework that provides simple APIs for browser automation.

## Getting Started

First, install the dependencies for this repository. This requires [pnpm](https://pnpm.io/installation#using-other-package-managers).

```bash
pnpm install
```

Next, copy the example environment variables:

```bash
cp .env.example .env.local
```

You'll need to set up your API keys:

1. Get your OpenAI API key from [OpenAI's dashboard](https://platform.openai.com/api-keys)

Update `.env.local` with your API keys:

- `OPENAI_API_KEY`: Your OpenAI API key

Install Playwright browsers for local automation:

```bash
npx playwright install
```

Then, run the development server:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see Open Operator in action.

## How It Works

Building a web agent is a complex task. You need to understand the user's intent, convert it into headless browser operations, and execute actions, each of which can be incredibly complex on their own.

![public/agent_mess.png](public/agent_mess.png)

Stagehand is a tool that helps you build web agents. It allows you to convert natural language into headless browser operations, execute actions on the browser, and extract results back into structured data.

![public/stagehand_clean.png](public/stagehand_clean.png)

Under the hood, we have a very simple agent loop that just calls Stagehand to convert the user's intent into headless browser operations, and then executes those operations using local Playwright browsers.

![public/agent_loop.png](public/agent_loop.png)

Stagehand uses local Playwright browsers to execute actions, and OpenAI to understand the user's intent.

### Key Technologies

- **[Stagehand](https://www.stagehand.dev)**: Handles precise DOM manipulation and state management with local Playwright
- **[Playwright](https://playwright.dev)**: Powers the core browser automation and interaction capabilities
- **[Next.js](https://nextjs.org)**: Provides the modern web framework foundation
- **[OpenAI](https://openai.com)**: Enable natural language understanding and decision making

## Local Browser Setup

This version of Open Operator runs browsers locally using Playwright instead of cloud services. The benefits include:

- **Privacy**: All browsing happens locally on your machine
- **Cost**: No external service fees
- **Performance**: Direct browser control without network latency
- **Debugging**: You can see the browser window in action (set `headless: false`)

## Contributing

We welcome contributions! Whether it's:

- Adding new features
- Improving documentation
- Reporting bugs
- Suggesting enhancements

Please feel free to open issues and pull requests.

## License

Open Operator is open source software licensed under the MIT license.

## Acknowledgments

This project is inspired by OpenAI's Operator feature and builds upon various open source technologies including Next.js, React, Playwright, and Stagehand.
