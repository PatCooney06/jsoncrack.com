import React, { useMemo, useState, useEffect } from "react";
import type { ModalProps } from "@mantine/core";
import {
  Modal,
  Stack,
  Text,
  ScrollArea,
  Flex,
  CloseButton,
  Button,
  Textarea,
  Alert,
} from "@mantine/core";
import { CodeHighlight } from "@mantine/code-highlight";
import type { NodeData } from "../types/graph";
import useGraph from "../features/editor/views/GraphView/stores/useGraph";
import useJson from "../store/useJson";

/* normalizeNodeData, jsonPathToString, getValueAtPath, setValueAtPath, pathEquals
   -- same helper implementations as before (keeps behaviour consistent) */
const normalizeNodeData = (nodeRows: NodeData["text"]) => {
  if (!nodeRows || nodeRows.length === 0) return "{}";
  if (nodeRows.length === 1 && !nodeRows[0].key) return `${nodeRows[0].value}`;

  const obj: Record<string, any> = {};
  nodeRows?.forEach((row) => {
    if (row.type !== "array" && row.type !== "object") {
      if (row.key) obj[row.key] = row.value;
    }
  });
  return JSON.stringify(obj, null, 2);
};

const jsonPathToString = (path?: NodeData["path"]) => {
  if (!path || path.length === 0) return "$";
  const segments = path.map((seg) => (typeof seg === "number" ? seg : `"${seg}"`));
  return `$[${segments.join("][")}]`;
};

const getValueAtPath = (root: any, path?: Array<string | number> | undefined) => {
  if (!path || path.length === 0) return root;
  let cursor = root;
  for (const seg of path) {
    if (cursor == null) return undefined;
    cursor = cursor[seg as any];
  }
  return cursor;
};

const setValueAtPath = (root: any, path: Array<string | number> | undefined, value: any) => {
  if (!path || path.length === 0) {
    return value;
  }
  const rootClone = Array.isArray(root) ? [...root] : { ...root };
  let cursor: any = rootClone;
  for (let i = 0; i < path.length - 1; i++) {
    const seg = path[i] as any;
    if (cursor[seg] === undefined || cursor[seg] === null) {
      const nextSeg = path[i + 1];
      cursor[seg] = typeof nextSeg === "number" ? [] : {};
    } else {
      cursor[seg] = Array.isArray(cursor[seg]) ? [...cursor[seg]] : { ...cursor[seg] };
    }
    cursor = cursor[seg];
  }
  const last = path[path.length - 1] as any;
  cursor[last] = value;
  return rootClone;
};

const pathEquals = (a?: Array<string | number>, b?: Array<string | number>) => {
  if (!a && !b) return true;
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  return a.every((v, i) => v === b[i]);
};

export const NodeModal = ({ opened, onClose }: ModalProps) => {
  const nodeData = useGraph((state) => state.selectedNode);
  const setSelectedNode = useGraph((s) => s.setSelectedNode);
  const getJson = useJson((s) => s.getJson);
  const setJson = useJson((s) => s.setJson);

  const originalText = useMemo(() => normalizeNodeData(nodeData?.text ?? []), [nodeData]);

  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState<string>(originalText);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setEditedText(originalText);
    setIsEditing(false);
    setError(null);
  }, [originalText, opened]);

  const handleSave = () => {
    setError(null);
    try {
      const parsed = JSON.parse(editedText);
      const currentJsonStr = getJson();
      let rootObj: any;
      try {
        rootObj = JSON.parse(currentJsonStr);
      } catch {
        rootObj = {};
      }

      if (!nodeData) {
        setError("No target node selected");
        return;
      }

      const nodeRows = nodeData.text ?? [];

      if (nodeRows.length === 1 && !nodeRows[0].key) {
        const newRoot = setValueAtPath(rootObj, nodeData.path, parsed);
        setJson(JSON.stringify(newRoot, null, 2));
      } else {
        const target = getValueAtPath(rootObj, nodeData.path);
        if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
          if (typeof target === "object" && target !== null && !Array.isArray(target)) {
            const merged = { ...target, ...parsed };
            const newRoot = setValueAtPath(rootObj, nodeData.path, merged);
            setJson(JSON.stringify(newRoot, null, 2));
          } else {
            const newRoot = setValueAtPath(rootObj, nodeData.path, parsed);
            setJson(JSON.stringify(newRoot, null, 2));
          }
        } else {
          const newRoot = setValueAtPath(rootObj, nodeData.path, parsed);
          setJson(JSON.stringify(newRoot, null, 2));
        }
      }

      setTimeout(() => {
        const nodes = useGraph.getState().nodes;
        const match = nodes.find((n) => pathEquals(n.path, nodeData?.path));
        if (match) {
          setSelectedNode(match);
        }
      }, 120);

      setIsEditing(false);
      if (onClose) onClose();
    } catch (err) {
      setError("Invalid JSON — please fix syntax before saving");
      // eslint-disable-next-line no-console
      console.error(err);
    }
  };

  const handleCancel = () => {
    setEditedText(originalText);
    setError(null);
    setIsEditing(false);
  };

  return (
    <Modal size="auto" opened={opened} onClose={onClose} centered withCloseButton={false}>
      <Stack pb="sm" gap="sm">
        <Stack gap="xs">
          <Flex justify="space-between" align="center">
            <Text fz="xs" fw={500}>
              Content
            </Text>
            <CloseButton onClick={onClose} />
          </Flex>

          <ScrollArea.Autosize mah={250} maw={600}>
            {!isEditing ? (
              <CodeHighlight
                code={normalizeNodeData(nodeData?.text ?? [])}
                miw={350}
                maw={600}
                language="json"
                withCopyButton
              />
            ) : (
              <>
                <Textarea
                  minRows={6}
                  styles={{ input: { fontFamily: "monospace" } }}
                  value={editedText}
                  onChange={(e) => setEditedText(e.currentTarget.value)}
                  aria-label="Edit node JSON"
                />
                {error && (
                  <Alert title="Error" color="red" mt="xs">
                    {error}
                  </Alert>
                )}
              </>
            )}
          </ScrollArea.Autosize>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            {!isEditing ? (
              <Button size="xs" onClick={() => setIsEditing(true)}>
                Edit
              </Button>
            ) : (
              <>
                <Button size="xs" variant="outline" onClick={handleCancel}>
                  Cancel
                </Button>
                <Button size="xs" onClick={handleSave}>
                  Save
                </Button>
              </>
            )}
          </div>
        </Stack>

        <Text fz="xs" fw={500}>
          JSON Path
        </Text>
        <ScrollArea.Autosize maw={600}>
          <CodeHighlight
            code={jsonPathToString(nodeData?.path)}
            miw={350}
            mah={250}
            language="json"
            copyLabel="Copy to clipboard"
            copiedLabel="Copied to clipboard"
            withCopyButton
          />
        </ScrollArea.Autosize>
      </Stack>
    </Modal>
  );
};

export default NodeModal;