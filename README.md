# DeesseJS Functions

![License](https://img.shields.io/badge/license-MIT-blue)
![TypeScript](https://img.shields.io/badge/types-TypeScript-lightgrey)

### Introduction

DeesseJS Functions is a collection of typed, composable utility helpers designed for the DeesseJS ecosystem. Small, focused, and functional, these helpers aim to improve clarity and reusability in TypeScript projects while keeping runtime weight minimal.

### Installation

Install from npm:

```bash
npm install @deessejs/functions
# or
yarn add @deessejs/functions
```

### Usage

Here’s a quick example showing how to define a context, create a typed API, and handle a mutation:

```ts
import { success } from "@deessejs/functions";
import { defineContext, rpc } from "@deessejs/functions";
import z from "zod";

const context = { userId: "123" };

const { t, createAPI } = defineContext(context).withExtensions([rpc]);

const createUser = t.mutation({
  args: z.object({ name: z.string() }),
  handler: async (ctx, args) => {
    return success({ id: 1, name: args.name });
  },
});

const api = createAPI({
  root: t.router({ auth: t.router({ createUser }) }),
});

const run = async () => {
  const res = await api.auth.createUser({ name: "Alice" });
  console.log("Result:", res);
};

run();
```

This demonstrates the core principles of DeesseJS Functions:

* Typed, composable utilities
* Context-aware API creation
* Functional, minimal runtime helpers

### Documentation

Full documentation and API reference: [https://functions.deessejs.com](https://functions.deessejs.com)
