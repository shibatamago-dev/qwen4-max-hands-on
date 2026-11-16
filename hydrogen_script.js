
    (() => {
      const SIZE = 10;
      const MAX_FLOOR = 3;
      const MAX_HP = 20;
      const PLAYER_ATK = 4;
      const HEAL_AMOUNT = 7;
      const ENEMY_COUNT = 3;
      const ITEM_COUNT = 2;

      const TILE_WALL = 1;
      const TILE_FLOOR = 0;

      const boardEl = document.getElementById("board");
      const hpTextEl = document.getElementById("hpText");
      const hpFillEl = document.getElementById("hpFill");
      const floorTextEl = document.getElementById("floorText");
      const killsTextEl = document.getElementById("killsText");
      const logBoxEl = document.getElementById("logBox");
      const overlayEl = document.getElementById("overlay");
      const overlayTitleEl = document.getElementById("overlayTitle");
      const overlayDescEl = document.getElementById("overlayDesc");
      const restartBtn = document.getElementById("restartBtn");
      const overlayRestartBtn = document.getElementById("overlayRestartBtn");

      let state = {};

      function keyOf(x, y) {
        return `${x},${y}`;
      }

      function shuffle(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
      }

      function generateFloorMap(floor) {
        while (true) {
          const grid = Array.from({ length: SIZE }, (_, y) =>
            Array.from({ length: SIZE }, (_, x) => {
              if (x === 0 || y === 0 || x === SIZE - 1 || y === SIZE - 1) {
                return TILE_WALL;
              }
              return Math.random() < 0.24 ? TILE_WALL : TILE_FLOOR;
            })
          );

          const floors = [];
          for (let y = 1; y < SIZE - 1; y++) {
            for (let x = 1; x < SIZE - 1; x++) {
              if (grid[y][x] === TILE_FLOOR) floors.push({ x, y });
            }
          }

          if (floors.length < 28) continue;

          // プレイヤーの開始位置を選び、BFSで到達可能マスを取得
          const start = floors[Math.floor(Math.random() * floors.length)];
          const dist = Array.from({ length: SIZE }, () => Array(SIZE).fill(-1));
          const queue = [start];
          dist[start.y][start.x] = 0;
          const reachable = [];

          while (queue.length > 0) {
            const cur = queue.shift();
            reachable.push({ x: cur.x, y: cur.y, d: dist[cur.y][cur.x] });
            const dirs = [
              [1, 0],
              [-1, 0],
              [0, 1],
              [0, -1],
            ];
            for (const [dx, dy] of dirs) {
              const nx = cur.x + dx;
              const ny = cur.y + dy;
              if (
                nx >= 0 &&
                nx < SIZE &&
                ny >= 0 &&
                ny < SIZE &&
                grid[ny][nx] === TILE_FLOOR &&
                dist[ny][nx] === -1
              ) {
                dist[ny][nx] = dist[cur.y][cur.x] + 1;
                queue.push({ x: nx, y: ny });
              }
            }
          }

          if (reachable.length < 24) continue;

          // 到達できない床は壁にしてマップを綺麗に整える
          const reachableSet = new Set(reachable.map((p) => keyOf(p.x, p.y)));
          for (let y = 1; y < SIZE - 1; y++) {
            for (let x = 1; x < SIZE - 1; x++) {
              if (!reachableSet.has(keyOf(x, y))) {
                grid[y][x] = TILE_WALL;
              }
            }
          }

          // 出口はプレイヤーから遠い候補から選ぶ
          reachable.sort((a, b) => b.d - a.d);
          const farPool = reachable.slice(0, Math.max(3, Math.floor(reachable.length * 0.25)));
          const exit = farPool[Math.floor(Math.random() * farPool.length)];

          if (exit.d < 4) continue;

          const used = new Set([keyOf(start.x, start.y), keyOf(exit.x, exit.y)]);

          // 敵3体はスタート地点に隣接しない場所優先
          const enemyCandidates = shuffle(
            reachable.filter((p) => !used.has(keyOf(p.x, p.y)) && p.d >= 2)
          );
          if (enemyCandidates.length < ENEMY_COUNT) continue;

          const enemies = [];
          const enemyHp = 7 + floor; // 1F:8, 2F:9, 3F:10
          const enemyAtk = 2 + Math.floor(floor / 2); // 1F:2, 2F:3, 3F:3

          for (let i = 0; i < ENEMY_COUNT; i++) {
            const pos = enemyCandidates[i];
            used.add(keyOf(pos.x, pos.y));
            enemies.push({
              id: i + 1,
              x: pos.x,
              y: pos.y,
              hp: enemyHp,
              maxHp: enemyHp,
              atk: enemyAtk,
            });
          }

          // 回復アイテム2個を空き床に配置
          const itemCandidates = shuffle(
            reachable.filter((p) => !used.has(keyOf(p.x, p.y)))
          );
          if (itemCandidates.length < ITEM_COUNT) continue;

          const items = [];
          for (let i = 0; i < ITEM_COUNT; i++) {
            const pos = itemCandidates[i];
            used.add(keyOf(pos.x, pos.y));
            items.push({ x: pos.x, y: pos.y });
          }

          return {
            grid,
            playerPos: { x: start.x, y: start.y },
            exit,
            enemies,
            items,
          };
        }
      }

      function initGame() {
        state = {
          hp: MAX_HP,
          maxHp: MAX_HP,
          floor: 1,
          kills: 0,
          gameOver: false,
          victory: false,
          log: "1階に降り立った。出口(🚪)を目指そう！",
          flashPlayer: false,
        };
        loadFloor(1);
        overlayEl.classList.remove("show");
        render();
      }

      function loadFloor(floor) {
        const mapData = generateFloorMap(floor);
        state.floor = floor;
        state.grid = mapData.grid;
        state.player = mapData.playerPos;
        state.exit = mapData.exit;
        state.enemies = mapData.enemies;
        state.items = mapData.items;
      }

      function getEnemyAt(x, y) {
        return state.enemies.find((e) => e.hp > 0 && e.x === x && e.y === y);
      }

      function getItemAt(x, y) {
        return state.items.findIndex((it) => it.x === x && it.y === y);
      }

      function findNextStepToPlayer(enemy) {
        const targetX = state.player.x;
        const targetY = state.player.y;

        // 隣接していればそのままプレイヤーのマスを返す（攻撃対象）
        if (Math.abs(enemy.x - targetX) + Math.abs(enemy.y - targetY) === 1) {
          return { x: targetX, y: targetY };
        }

        // BFSで他の生存敵を避けつつ最短経路を探す
        const blocked = new Set(
          state.enemies
            .filter((e) => e.hp > 0 && e.id !== enemy.id)
            .map((e) => keyOf(e.x, e.y))
        );

        const queue = [{ x: enemy.x, y: enemy.y, firstStep: null }];
        const visited = new Set([keyOf(enemy.x, enemy.y)]);
        const dirs = [
          [0, -1],
          [0, 1],
          [-1, 0],
          [1, 0],
        ];

        while (queue.length > 0) {
          const cur = queue.shift();
          for (const [dx, dy] of dirs) {
            const nx = cur.x + dx;
            const ny = cur.y + dy;
            if (nx < 0 || nx >= SIZE || ny < 0 || ny >= SIZE) continue;
            if (state.grid[ny][nx] === TILE_WALL) continue;

            const k = keyOf(nx, ny);
            if (visited.has(k)) continue;
            if (blocked.has(k)) continue;

            const step = cur.firstStep || { x: nx, y: ny };
            if (nx === targetX && ny === targetY) {
              return step;
            }

            visited.add(k);
            queue.push({ x: nx, y: ny, firstStep: step });
          }
        }

        // 経路が塞がれている場合は距離が縮まる空きマスへ移動
        let best = null;
        let bestDist = Math.abs(enemy.x - targetX) + Math.abs(enemy.y - targetY);
        for (const [dx, dy] of dirs) {
          const nx = enemy.x + dx;
          const ny = enemy.y + dy;
          if (nx < 0 || nx >= SIZE || ny < 0 || ny >= SIZE) continue;
          if (state.grid[ny][nx] === TILE_WALL) continue;
          if (blocked.has(keyOf(nx, ny))) continue;
          const d = Math.abs(nx - targetX) + Math.abs(ny - targetY);
          if (d < bestDist) {
            bestDist = d;
            best = { x: nx, y: ny };
          }
        }
        return best;
      }

      function movePlayer(dx, dy) {
        if (state.gameOver || state.victory) return;

        const nx = state.player.x + dx;
        const ny = state.player.y + dy;

        if (nx < 0 || nx >= SIZE || ny < 0 || ny >= SIZE) return;
        if (state.grid[ny][nx] === TILE_WALL) {
          state.log = "壁に阻まれて進めない。";
          render();
          return;
        }

        const logs = [];
        state.flashPlayer = false;

        // 敵がいれば攻撃（移動せず戦闘）
        const targetEnemy = getEnemyAt(nx, ny);
        if (targetEnemy) {
          targetEnemy.hp = Math.max(0, targetEnemy.hp - PLAYER_ATK);
          if (targetEnemy.hp === 0) {
            state.kills += 1;
            logs.push(`敵に${PLAYER_ATK}ダメージ！敵を倒した！`);
          } else {
            logs.push(`敵に${PLAYER_ATK}ダメージ！(敵残りHP:${targetEnemy.hp})`);
          }
        } else {
          // 空きマスへ移動
          state.player.x = nx;
          state.player.y = ny;

          // 回復アイテム取得判定
          const itemIdx = getItemAt(nx, ny);
          if (itemIdx !== -1) {
            state.items.splice(itemIdx, 1);
            const prevHp = state.hp;
            state.hp = Math.min(state.maxHp, state.hp + HEAL_AMOUNT);
            const healed = state.hp - prevHp;
            logs.push(`回復薬を拾ってHPが${healed}回復！`);
          }

          // 出口到達判定
          if (nx === state.exit.x && ny === state.exit.y) {
            if (state.floor >= MAX_FLOOR) {
              state.victory = true;
              state.log = "3階の出口に到達！ダンジョンを踏破した！";
              showEndOverlay(
                "🎉 ゲームクリア！",
                `全3階を踏破しました！ 撃破数: ${state.kills}体 / 残りHP: ${state.hp}`
              );
              render();
              return;
            } else {
              const nextFloor = state.floor + 1;
              loadFloor(nextFloor);
              state.log = `${nextFloor}階へ降りた！敵が少し強くなった気がする…`;
              render();
              return;
            }
          }
        }

        // プレイヤー行動後、生存中の敵が1マスずつ追跡＆接触攻撃
        for (const enemy of state.enemies) {
          if (enemy.hp <= 0) continue;
          const next = findNextStepToPlayer(enemy);
          if (!next) continue;

          if (next.x === state.player.x && next.y === state.player.y) {
            state.hp = Math.max(0, state.hp - enemy.atk);
            state.flashPlayer = true;
            logs.push(`敵の攻撃！${enemy.atk}ダメージを受けた！`);
            if (state.hp === 0) {
              state.gameOver = true;
              break;
            }
          } else {
            enemy.x = next.x;
            enemy.y = next.y;
          }
        }

        state.log = logs.length > 0 ? logs.join(" / ") : "ダンジョンを進んだ。";

        if (state.gameOver) {
          showEndOverlay(
            "💀 ゲームオーバー",
            `${state.floor}階で力尽きた… 撃破数: ${state.kills}体`
          );
        }

        render();
      }

      function showEndOverlay(title, desc) {
        overlayTitleEl.textContent = title;
        overlayDescEl.textContent = desc;
        overlayEl.classList.add("show");
      }

      function render() {
        hpTextEl.textContent = `${state.hp} / ${state.maxHp}`;
        const hpRatio = Math.max(0, (state.hp / state.maxHp) * 100);
        hpFillEl.style.width = `${hpRatio}%`;
        hpFillEl.style.backgroundColor = hpRatio <= 30 ? "var(--hp-low)" : "var(--hp)";
        floorTextEl.textContent = `${state.floor} / ${MAX_FLOOR} F`;
        killsTextEl.textContent = `${state.kills} 体`;
        logBoxEl.textContent = state.log;

        boardEl.innerHTML = "";
        const fragment = document.createDocumentFragment();

        for (let y = 0; y < SIZE; y++) {
          for (let x = 0; x < SIZE; x++) {
            const cell = document.createElement("div");
            cell.className = "cell";

            if (state.grid[y][x] === TILE_WALL) {
              cell.classList.add("wall");
            } else {
              cell.classList.add("floor");
              if ((x + y) % 2 === 1) cell.classList.add("alt");

              const isExit = state.exit.x === x && state.exit.y === y;
              const isPlayer = state.player.x === x && state.player.y === y;
              const enemy = getEnemyAt(x, y);
              const hasItem = getItemAt(x, y) !== -1;

              if (isExit) {
                cell.classList.add("exit");
              }

              if (isPlayer) {
                cell.textContent = "🧙";
                if (state.flashPlayer) {
                  cell.classList.add("hit-flash");
                }
              } else if (enemy) {
                cell.textContent = "👾";
                const hpBadge = document.createElement("span");
                hpBadge.className = "enemy-hp";
                hpBadge.textContent = enemy.hp;
                cell.appendChild(hpBadge);
              } else if (hasItem) {
                cell.textContent = "🧪";
              } else if (isExit) {
                cell.textContent = "🚪";
              }
            }
            fragment.appendChild(cell);
          }
        }

        boardEl.appendChild(fragment);
      }

      // キーボード操作（矢印キー / WASD）
      window.addEventListener("keydown", (e) => {
        const key = e.key.toLowerCase();
        let dx = 0;
        let dy = 0;

        if (key === "arrowup" || key === "w") dy = -1;
        else if (key === "arrowdown" || key === "s") dy = 1;
        else if (key === "arrowleft" || key === "a") dx = -1;
        else if (key === "arrowright" || key === "d") dx = 1;
        else return;

        e.preventDefault();
        movePlayer(dx, dy);
      });

      // スマホ用ボタン操作
      document.querySelectorAll(".pad-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          const dx = Number(btn.dataset.dx);
          const dy = Number(btn.dataset.dy);
          movePlayer(dx, dy);
        });
      });

      restartBtn.addEventListener("click", initGame);
      overlayRestartBtn.addEventListener("click", initGame);

      initGame();
    })();
  