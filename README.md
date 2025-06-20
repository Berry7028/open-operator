# Open Operator

> [!WARNING]
> This is simply a proof of concept.
> This project demonstrates how to build a web automation agent using Playwright. It provides all the necessary tools for anybody to build their own web agent.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fbrowserbase%2Fopen-operator&env=ANTHROPIC_API_KEY&envDescription=API%20keys%20needed%20to%20run%20Open%20Operator&envLink=https%3A%2F%2Fgithub.com%2Fbrowserbase%2Fopen-operator%23environment-variables)

## Getting Started

First, install the dependencies for this repository. This requires [pnpm](https://pnpm.io/installation#using-other-package-managers).

<!-- This doesn't work with NPM, haven't tested with yarn -->

```bash
pnpm install
```

Next, copy the example environment variables:

```bash
cp .env.example .env.local
```

You'll need to set up your API keys:

1. Get your Anthropic API key from [Anthropic's dashboard](https://console.anthropic.com/)

Update `.env.local` with your API keys:

- `ANTHROPIC_API_KEY`: Your Anthropic API key

Then, run the development server:

<!-- This doesn't work with NPM, haven't tested with yarn -->

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see Open Operator in action.

## How It Works

Building a web agent is a complex task. You need to understand the user's intent, convert it into browser operations, and execute actions, each of which can be incredibly complex on their own.

![public/agent_mess.png](public/agent_mess.png)

This project uses Playwright to automate browser operations. It allows you to convert natural language into browser automation commands, execute actions on the browser, and extract results back into structured data.

![public/stagehand_clean.png](public/stagehand_clean.png)

Under the hood, we have a very simple agent loop that uses Claude (Anthropic's AI) to understand the user's intent and convert it into Playwright browser operations.

![public/agent_loop.png](public/agent_loop.png)

The agent uses Playwright to execute actions on the browser, and Anthropic Claude to understand the user's intent.

### Key Technologies

- **[Playwright](https://playwright.dev)**: Powers the core browser automation and interaction capabilities
- **[Next.js](https://nextjs.org)**: Provides the modern web framework foundation
- **[Anthropic Claude](https://anthropic.com)**: Enables natural language understanding and decision making
- **Manus-style UI**: Clean, minimal dark theme without glow effects

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

This project is inspired by OpenAI's Operator feature and builds upon various open source technologies including Next.js, React, Playwright, and Anthropic Claude.
