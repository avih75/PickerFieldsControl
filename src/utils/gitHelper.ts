import { RepoInfo } from "../types";

/** Push CSV content to a Git repository via Azure DevOps REST API.
 *  Uses the native fetch API available in modern browsers. */
export async function pushToGit(
  csvContent: string,
  controlName: string,
  info: RepoInfo,
  baseUrl: string,
  token: string
): Promise<void> {
  const { repoProject, repoName } = info;
  const base = `${baseUrl}/${encodeURIComponent(repoProject)}/_apis/git/repositories/${encodeURIComponent(repoName)}`;
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
  const filePath = `/${controlName}.csv`;

  // Get repo refs to find master/main
  const refsRes = await fetch(`${base}/refs?filter=heads&api-version=6.0`, { headers });
  const refsData = await refsRes.json();
  const ref: { name: string; objectId: string } | undefined = refsData.value?.find(
    (r: any) => r.name === "refs/heads/master" || r.name === "refs/heads/main"
  );
  if (!ref) return;

  // Check if file exists
  let changeType = 1; // add
  try {
    const itemRes = await fetch(
      `${base}/items?path=${encodeURIComponent(filePath)}&api-version=6.0`,
      { headers }
    );
    if (itemRes.ok) changeType = 2; // edit
  } catch (_) {}

  const body = JSON.stringify({
    refUpdates: [{ name: ref.name, oldObjectId: ref.objectId }],
    commits: [
      {
        comment: changeType === 1 ? "Upload New File" : "Upload Edited File",
        changes: [
          {
            changeType,
            item: { path: filePath },
            newContent: { content: csvContent, contentType: 0 },
          },
        ],
      },
    ],
  });

  await fetch(`${base}/pushes?api-version=6.0`, {
    method: "POST",
    headers,
    body,
  });
}
