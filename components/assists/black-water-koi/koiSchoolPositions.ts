/** Latest XZ position per fish for lightweight neighbor avoidance. */
const positions = new Map<string, { x: number; z: number }>();

export function setKoiSchoolPosition(id: string, x: number, z: number) {
  let p = positions.get(id);
  if (!p) {
    p = { x: 0, z: 0 };
    positions.set(id, p);
  }
  p.x = x;
  p.z = z;
}

export function removeKoiSchoolPosition(id: string) {
  positions.delete(id);
}

export function forEachKoiNeighbor(
  selfId: string,
  fn: (x: number, z: number) => void,
) {
  positions.forEach((p, id) => {
    if (id !== selfId) fn(p.x, p.z);
  });
}
