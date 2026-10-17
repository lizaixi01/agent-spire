import { describe, expect, it } from "vitest";
import { createRun, availableNodes, enterNode } from "../src/engine";
import { encodeRun, decodeRun } from "../src/save";

describe("存档与恢复", () => {
  it("兼容旧战斗缺失的案例字段，拒绝伪造案例、答案次序与连携引用", () => {
    const start = createRun("scholar", 42);
    const fight = enterNode(start, availableNodes(start)[0].id);
    const legacy = structuredClone(fight);
    delete legacy.battle!.lab;
    delete legacy.battle!.sequence;
    expect(decodeRun(encodeRun(legacy))).not.toBeNull();
    for (const patch of [
      { lab: { caseId: "constructor", choice: null, transfer: null } },
      { lab: { caseId: "missing-file", choice: null, transfer: 1 } },
      { lab: { caseId: "missing-file", choice: 7, transfer: null } },
      { sequence: ["unknown-card"] },
    ]) {
      const malformed = structuredClone(fight);
      Object.assign(malformed.battle!, patch);
      expect(decodeRun(encodeRun(malformed))).toBeNull();
    }
  });
  it("战斗中断后恢复完整手牌、随机状态和资源", () => {
    const run = createRun("engineer", 123);
    const fighting = enterNode(run, availableNodes(run)[0].id);
    expect(decodeRun(encodeRun(fighting))).toEqual(fighting);
  });
  it("拒绝损坏、旧版本、无效资源与不存在的卡牌", () => {
    expect(decodeRun("{broken")).toBeNull();
    expect(decodeRun("{}")).toBeNull();
    const run = createRun("scholar", 1);
    expect(decodeRun(JSON.stringify({ ...run, version: 9 }))).toBeNull();
    run.player.hp = -1;
    expect(decodeRun(JSON.stringify(run))).toBeNull();
    run.player.hp = 80;
    run.deck[0].defId = "unknown";
    expect(decodeRun(JSON.stringify(run))).toBeNull();
  });
  it("拒绝半截战斗、畸形地图和不存在的课程引用，界面可安全回退", () => {
    const run = createRun("scholar", 1);
    expect(decodeRun(JSON.stringify({ ...run, screen: "combat" }))).toBeNull();
    expect(decodeRun(JSON.stringify({ ...run, map: [null] }))).toBeNull();
    expect(
      decodeRun(JSON.stringify({ ...run, learned: ["not-a-lesson"] })),
    ).toBeNull();
  });
  it("拒绝原型键伪造课程、没有敌人的战斗和不合法的屏幕", () => {
    const run = createRun("scholar", 1);
    expect(
      decodeRun(JSON.stringify({ ...run, learned: ["constructor"] })),
    ).toBeNull();
    expect(decodeRun(JSON.stringify({ ...run, screen: "boss" }))).toBeNull();
    const fighting = enterNode(run, availableNodes(run)[0].id);
    fighting.battle!.enemies = [];
    expect(decodeRun(JSON.stringify(fighting))).toBeNull();
  });
});
