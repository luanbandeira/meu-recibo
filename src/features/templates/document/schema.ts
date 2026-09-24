import { z } from "zod";
import {
  FONT_KEYS,
  FONT_SIZES,
  HEADER_LAYOUTS,
  IMAGE_SIZES,
  LINE_HEIGHTS,
  MARGINS,
  MAX_DOC_NODES,
  MAX_LIST_DEPTH,
  MAX_TEXT_LENGTH,
  TEXT_ALIGNS,
} from "./constants";
import { VARIABLE_KEY_PATTERN } from "./variables";

/**
 * Validação do conteúdo do editor (JSON do TipTap/ProseMirror).
 *
 * É a barreira contra XSS e contra documentos malformados: só existem os
 * nós, marcas e atributos listados aqui, com valores em listas fechadas.
 * O conteúdo NUNCA é HTML; é sempre renderizado por mapeamento nó → componente.
 */

const align = z.enum(TEXT_ALIGNS).nullable().optional();
const lineHeight = z
  .number()
  .refine((v) => (LINE_HEIGHTS as readonly number[]).includes(v))
  .nullable()
  .optional();
const blockAttrs = z.object({ textAlign: align, lineHeight }).strict().optional();

const markSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("bold") }).strict(),
  z.object({ type: z.literal("italic") }).strict(),
  z.object({ type: z.literal("underline") }).strict(),
  z
    .object({
      type: z.literal("textStyle"),
      attrs: z
        .object({
          fontFamily: z.enum(FONT_KEYS as [string, ...string[]]).nullable().optional(),
          fontSize: z
            .number()
            .refine((v) => (FONT_SIZES as readonly number[]).includes(v))
            .nullable()
            .optional(),
        })
        .strict()
        .optional(),
    })
    .strict(),
]);

const textNode = z
  .object({
    type: z.literal("text"),
    text: z.string().min(1).max(MAX_TEXT_LENGTH),
    marks: z.array(markSchema).max(8).optional(),
  })
  .strict();

const hardBreak = z.object({ type: z.literal("hardBreak"), marks: z.array(markSchema).optional() }).strict();

const variableNode = z
  .object({
    type: z.literal("variable"),
    attrs: z
      .object({
        key: z.string().regex(VARIABLE_KEY_PATTERN),
        format: z.enum(["short", "long"]).nullable().optional(),
      })
      .strict(),
    marks: z.array(markSchema).max(8).optional(),
  })
  .strict();

const inline = z.union([textNode, hardBreak, variableNode]);

const paragraph = z
  .object({ type: z.literal("paragraph"), attrs: blockAttrs, content: z.array(inline).optional() })
  .strict();

const heading = z
  .object({
    type: z.literal("heading"),
    attrs: z
      .object({ level: z.union([z.literal(1), z.literal(2), z.literal(3)]), textAlign: align, lineHeight })
      .strict(),
    content: z.array(inline).optional(),
  })
  .strict();

const horizontalRule = z.object({ type: z.literal("horizontalRule") }).strict();

const imageAttrs = z
  .object({
    align: z.enum(["left", "center", "right"]),
    size: z.enum(Object.keys(IMAGE_SIZES) as [string, ...string[]]),
  })
  .strict();

const professionalHeader = z
  .object({
    type: z.literal("professionalHeader"),
    attrs: z.object({ layout: z.enum(Object.keys(HEADER_LAYOUTS) as [string, ...string[]]) }).strict(),
  })
  .strict();

const logo = z.object({ type: z.literal("logo"), attrs: imageAttrs }).strict();

const signature = z
  .object({ type: z.literal("signature"), attrs: imageAttrs.extend({ showName: z.boolean() }).strict() })
  .strict();

type ListNode = { type: "bulletList" | "orderedList"; attrs?: unknown; content: { type: "listItem"; content: unknown[] }[] };

const listItem: z.ZodType = z.lazy(() =>
  z
    .object({
      type: z.literal("listItem"),
      content: z.array(z.union([paragraph, bulletList, orderedList])).min(1),
    })
    .strict(),
);

const bulletList: z.ZodType<ListNode> = z.lazy(() =>
  z.object({ type: z.literal("bulletList"), content: z.array(listItem).min(1) }).strict(),
) as z.ZodType<ListNode>;

const orderedList: z.ZodType<ListNode> = z.lazy(() =>
  z
    .object({
      type: z.literal("orderedList"),
      attrs: z.object({ start: z.number().int().min(1).max(999), type: z.string().nullable().optional() }).strict().optional(),
      content: z.array(listItem).min(1),
    })
    .strict(),
) as z.ZodType<ListNode>;

const block = z.union([paragraph, heading, horizontalRule, professionalHeader, logo, signature, bulletList, orderedList]);

type JsonNode = { type?: string; content?: JsonNode[] };

function countNodes(node: JsonNode): number {
  return 1 + (node.content ?? []).reduce((sum, child) => sum + countNodes(child), 0);
}

function listDepth(node: JsonNode, depth = 0): number {
  const isList = node.type === "bulletList" || node.type === "orderedList";
  const current = depth + (isList ? 1 : 0);
  return Math.max(current, ...(node.content ?? []).map((child) => listDepth(child, current)));
}

export const templateContentSchema = z
  .object({ type: z.literal("doc"), content: z.array(block).max(500) })
  .strict()
  .refine((doc) => countNodes(doc as JsonNode) <= MAX_DOC_NODES, "Documento grande demais.")
  .refine((doc) => listDepth(doc as JsonNode) <= MAX_LIST_DEPTH, "Listas aninhadas demais.");

export type TemplateContent = z.infer<typeof templateContentSchema>;

export const templateSettingsSchema = z
  .object({
    fontFamily: z.enum(FONT_KEYS as [string, ...string[]]),
    fontSize: z.number().refine((v) => (FONT_SIZES as readonly number[]).includes(v)),
    lineHeight: z.number().refine((v) => (LINE_HEIGHTS as readonly number[]).includes(v)),
    margins: z.enum(Object.keys(MARGINS) as [string, ...string[]]),
  })
  .strict();
