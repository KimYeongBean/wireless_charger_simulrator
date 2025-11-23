import React, { useEffect, useMemo, useRef, useState } from "react";
import { Play, Pause, RotateCcw, Zap } from "lucide-react";

// 패드 캔버스 크기(mm 기준 비례)
const PAD_WIDTH = 500;
const PAD_HEIGHT = 400;
// 코일(폰) 표시 크기와 암 길이 최소치
const COIL_RADIUS = 25;
const MIN_ARM_LENGTH = 50;
// 휴대폰 영역 크기와 기기간 최소 여유
const PHONE_WIDTH = 60;
const PHONE_HEIGHT = 90;
const MIN_DEVICE_GAP = 0;
// 캔버스 상·하단 여백과 와이퍼 간 최소 거리
const BOTTOM_MARGIN = 18;
const TOP_MARGIN = 40;
const MIN_WIPER_GAP = COIL_RADIUS * 2;

// 패드 네 모서리 좌표
const padCorners = [
  { x: 0, y: 0 },
  { x: PAD_WIDTH, y: 0 },
  { x: 0, y: PAD_HEIGHT },
  { x: PAD_WIDTH, y: PAD_HEIGHT },
];

// 값 제한, 각도 계산 유틸
const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const deg = radians => (radians * 180) / Math.PI;
const normalizeAngle = angle => {
  let value = angle % 360;
  if (value < 0) value += 360;
  return value;
};

// 특정 축에서 패드 네 귀퉁이까지의 최대 도달 거리 계산
const calculateMaxReach = base =>
  Math.max(
    ...padCorners.map(corner => Math.hypot(corner.x - base.x, corner.y - base.y))
  );

// Wiper anchors are fixed at two bottom corners and the top centre.
// 와이퍼 고정 지점과 기본 각도/색상
const RAW_WIPER_BASES = [
  { x: PAD_WIDTH * 0.18, y: PAD_HEIGHT - BOTTOM_MARGIN, angle: 270, color: "#3b82f6" },
  { x: PAD_WIDTH * 0.82, y: PAD_HEIGHT - BOTTOM_MARGIN, angle: 270, color: "#ef4444" },
  { x: PAD_WIDTH * 0.18, y: TOP_MARGIN, angle: 90, color: "#10b981" },
  { x: PAD_WIDTH * 0.82, y: TOP_MARGIN, angle: 90, color: "yellow" },
];

// 각 축 기준 최대 암 길이 부여
const WIPER_BASES = RAW_WIPER_BASES.map(base => ({
  ...base,
  maxArmLength: calculateMaxReach(base),
  // maxArmLength: 400,
}));

// 가장 긴 암 길이(표기용)
const MAX_COMPUTED_ARM_LENGTH = Math.max(...WIPER_BASES.map(base => base.maxArmLength));

// 초기 기기 배치 좌표
const DEFAULT_DEVICES = [
  { x: PAD_WIDTH * 0.35, y: PAD_HEIGHT * 0.25 },
  { x: PAD_WIDTH * 0.65, y: PAD_HEIGHT * 0.5 },
  { x: PAD_WIDTH * 0.35, y: PAD_HEIGHT * 0.55 },
  { x: PAD_WIDTH * 0.85, y: PAD_HEIGHT * 0.70 },
];

// 초기 기기 배열에 id와 on/off 상태 추가
const buildDefaultDevices = () =>
  DEFAULT_DEVICES.map((device, idx) => ({
    ...device,
    id: idx,
    enabled: true,
  }));

// 암 시작점과 각도, 길이로 끝점 좌표 계산
const endpoint = (base, length, angle) => ({
  x: base.x + Math.cos((angle * Math.PI) / 180) * length,
  y: base.y + Math.sin((angle * Math.PI) / 180) * length,
});

// 선분 교차 판단 유틸
const orientation = (a, b, c) => {
  const value = (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y);
  if (Math.abs(value) < 1e-6) return 0;
  return value > 0 ? 1 : 2;
};

const onSegment = (a, b, c) =>
  Math.min(a.x, c.x) - 1e-6 <= b.x &&
  b.x <= Math.max(a.x, c.x) + 1e-6 &&
  Math.min(a.y, c.y) - 1e-6 <= b.y &&
  b.y <= Math.max(a.y, c.y) + 1e-6;

const segmentsIntersect = (p1, q1, p2, q2) => {
  const o1 = orientation(p1, q1, p2);
  const o2 = orientation(p1, q1, q2);
  const o3 = orientation(p2, q2, p1);
  const o4 = orientation(p2, q2, q1);

  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && onSegment(p1, p2, q1)) return true;
  if (o2 === 0 && onSegment(p1, q2, q1)) return true;
  if (o3 === 0 && onSegment(p2, p1, q2)) return true;
  if (o4 === 0 && onSegment(p2, q1, q1)) return true;
  return false;
};

const distancePointToSegment = (point, segStart, segEnd) => {
  const dx = segEnd.x - segStart.x;
  const dy = segEnd.y - segStart.y;
  if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) {
    return Math.hypot(point.x - segStart.x, point.y - segStart.y);
  }
  const t = ((point.x - segStart.x) * dx + (point.y - segStart.y) * dy) / (dx * dx + dy * dy);
  const clamped = clamp(t, 0, 1);
  const closest = { x: segStart.x + clamped * dx, y: segStart.y + clamped * dy };
  return Math.hypot(point.x - closest.x, point.y - closest.y);
};

// 두 선분 간 최소 거리(교차 시 0)
const segmentDistance = (a1, a2, b1, b2) => {
  if (segmentsIntersect(a1, a2, b1, b2)) return 0;
  return Math.min(
    distancePointToSegment(a1, b1, b2),
    distancePointToSegment(a2, b1, b2),
    distancePointToSegment(b1, a1, a2),
    distancePointToSegment(b2, a1, a2)
  );
};

// 휴대폰 직사각형이 최소 간격 미만으로 겹치는지 체크
const rectanglesOverlapWithGap = (a, b) => {
  const xThreshold = PHONE_WIDTH + MIN_DEVICE_GAP;
  const yThreshold = PHONE_HEIGHT + MIN_DEVICE_GAP;
  return Math.abs(a.x - b.x) < xThreshold && Math.abs(a.y - b.y) < yThreshold;
};

// 각도를 -180~180 기준으로 보간
const interpolateAngle = (start, target, t) => {
  let diff = target - start;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;
  return start + diff * t;
};

// 와이퍼 이동 중에도 최소 간격 유지 여부 샘플링 검사
const segmentsTooCloseDuringMotion = (currentWipers, targets) => {
  const movingTargets = targets.filter(target => target.deviceIdx !== null && target.reachable);
  if (movingTargets.length <= 1) return false;

  const samples = [0, 0.25, 0.5, 0.75, 1];
  for (let i = 0; i < movingTargets.length; i += 1) {
    for (let j = i + 1; j < movingTargets.length; j += 1) {
      const targetA = movingTargets[i];
      const targetB = movingTargets[j];
      const startA = currentWipers[targetA.wiperIdx];
      const startB = currentWipers[targetB.wiperIdx];
      const baseA = WIPER_BASES[targetA.wiperIdx];
      const baseB = WIPER_BASES[targetB.wiperIdx];

      const startAngleA = startA?.currentAngle ?? baseA.angle;
      const startAngleB = startB?.currentAngle ?? baseB.angle;
      const startLenA = startA?.currentLength ?? MIN_ARM_LENGTH;
      const startLenB = startB?.currentLength ?? MIN_ARM_LENGTH;

      for (const t of samples) {
        const angleA = interpolateAngle(startAngleA, targetA.angle, t);
        const angleB = interpolateAngle(startAngleB, targetB.angle, t);
        const lenA = startLenA + (targetA.targetLength - startLenA) * t;
        const lenB = startLenB + (targetB.targetLength - startLenB) * t;

        const endA = endpoint(baseA, lenA, angleA);
        const endB = endpoint(baseB, lenB, angleB);

        if (segmentDistance(baseA, endA, baseB, endB) < MIN_WIPER_GAP) {
          return true;
        }
      }
    }
  }
  return false;
};

// 기기 수만큼 기본 통계 구조 생성
const emptyStats = count => ({
  deviceStatuses: Array.from({ length: count }, () => ({
    reachable: false,
    assignedWiper: null,
    distance: 0,
    reason: "unassigned",
  })),
  coveragePercent: 0,
  activeWipers: 0,
});

const WiperChargingSimulator = () => {
  // 캔버스 참조와 재생/기기/통계 상태
  const canvasRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [devices, setDevices] = useState(() => buildDefaultDevices());
  const [draggingDeviceId, setDraggingDeviceId] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [stats, setStats] = useState(() => emptyStats(DEFAULT_DEVICES.length));

  // 와이퍼 현재 상태(애니메이션 샘플링용) 참조
  const wipersRef = useRef([]);
  const [wipers, setWipers] = useState(() => {
    const initial = WIPER_BASES.map(base => ({
      ...base,
      currentLength: MIN_ARM_LENGTH,
      targetLength: MIN_ARM_LENGTH,
      currentAngle: base.angle,
      targetAngle: base.angle,
      isActive: false,
      assignedDevice: null,
    }));
    wipersRef.current = initial;
    return initial;
  });

  // 켜진 기기만 추린 목록
  const activeDevices = useMemo(() => devices.filter(device => device.enabled), [devices]);

  useEffect(() => {
    wipersRef.current = wipers;
  }, [wipers]);

  // 활성 기기에 대해 충돌 없는 최적 와이퍼 할당과 목표 벡터 계산
  const updateWiperTargets = currentDevices => {
    const deviceList = currentDevices ?? [];
    const currentWipers = wipersRef.current.length ? wipersRef.current : wipers;
    const assignments = [];
    const usedDevices = new Set();

    // 백트래킹으로 모든 와이퍼-기기 매칭 조합 생성
    const buildAssignments = (wiperIdx, current) => {
      if (wiperIdx === WIPER_BASES.length) {
        assignments.push([...current]);
        return;
      }

      current.push(null);
      buildAssignments(wiperIdx + 1, current);
      current.pop();

      for (let deviceIdx = 0; deviceIdx < deviceList.length; deviceIdx += 1) {
        if (usedDevices.has(deviceIdx)) continue;
        current.push(deviceIdx);
        usedDevices.add(deviceIdx);
        buildAssignments(wiperIdx + 1, current);
        usedDevices.delete(deviceIdx);
        current.pop();
      }
    };

    buildAssignments(0, []);

    let best = null;

    assignments.forEach(assignment => {
      const targets = assignment.map((deviceIdx, wiperIdx) => {
        const base = WIPER_BASES[wiperIdx];
        if (deviceIdx === null || deviceIdx === undefined) {
          return {
            wiperIdx,
            deviceIdx: null,
            angle: base.angle,
            targetLength: MIN_ARM_LENGTH,
            reachable: false,
            distance: 0,
          };
        }
        const device = deviceList[deviceIdx];
        const dx = device.x - base.x;
        const dy = device.y - base.y;
        const distance = Math.hypot(dx, dy);
        const angle = normalizeAngle(deg(Math.atan2(dy, dx)));
        return {
          wiperIdx,
          deviceIdx,
          angle,
          targetLength: clamp(distance, MIN_ARM_LENGTH, base.maxArmLength),
          reachable: distance <= base.maxArmLength,
          distance,
        };
      });

      let collision = false;
      let minimumSeparation = Infinity;

      if (segmentsTooCloseDuringMotion(currentWipers, targets)) {
        collision = true;
      }

      for (let i = 0; i < targets.length && !collision; i += 1) {
        for (let j = i + 1; j < targets.length && !collision; j += 1) {
          const first = targets[i];
          const second = targets[j];
          const firstIdle = first.deviceIdx === null && first.targetLength === MIN_ARM_LENGTH;
          const secondIdle = second.deviceIdx === null && second.targetLength === MIN_ARM_LENGTH;
          if (firstIdle && secondIdle) continue;

          const baseA = WIPER_BASES[first.wiperIdx];
          const baseB = WIPER_BASES[second.wiperIdx];
          const endA = endpoint(baseA, first.targetLength, first.angle);
          const endB = endpoint(baseB, second.targetLength, second.angle);

          if (segmentsIntersect(baseA, endA, baseB, endB)) {
            collision = true;
            break;
          }

          const separation = segmentDistance(baseA, endA, baseB, endB);
          minimumSeparation = Math.min(minimumSeparation, separation);

          if (separation < MIN_WIPER_GAP) {
            collision = true;
            break;
          }
        }
      }

      if (collision) return;

      const reachableCount = targets.filter(target => target.deviceIdx !== null && target.reachable).length;
      const assignedCount = targets.filter(target => target.deviceIdx !== null).length;
      const distanceSum = targets.reduce(
        (sum, target) => sum + (target.deviceIdx !== null ? target.distance : 0),
        0
      );
      const separationScore = Number.isFinite(minimumSeparation) ? minimumSeparation : Number.MAX_SAFE_INTEGER;

      if (
        !best ||
        reachableCount > best.reachableCount ||
        (reachableCount === best.reachableCount && assignedCount > best.assignedCount) ||
        (reachableCount === best.reachableCount &&
          assignedCount === best.assignedCount &&
          separationScore > best.separationScore + 1e-6) ||
        (reachableCount === best.reachableCount &&
          assignedCount === best.assignedCount &&
          Math.abs(separationScore - best.separationScore) <= 1e-6 &&
          distanceSum < best.distanceSum)
      ) {
        best = { targets, reachableCount, assignedCount, separationScore, distanceSum };
      }
    });

    if (!best) {
      best = {
        targets: WIPER_BASES.map((base, idx) => ({
          wiperIdx: idx,
          deviceIdx: null,
          angle: base.angle,
          targetLength: MIN_ARM_LENGTH,
          reachable: false,
          distance: 0,
        })),
        reachableCount: 0,
        assignedCount: 0,
        separationScore: 0,
        distanceSum: 0,
      };
    }

    const deviceStatuses = deviceList.map(() => ({
      reachable: false,
      assignedWiper: null,
      distance: 0,
      reason: "unassigned",
    }));

    best.targets.forEach(target => {
      if (target.deviceIdx === null) return;
      deviceStatuses[target.deviceIdx] = {
        reachable: target.reachable,
        assignedWiper: target.wiperIdx,
        distance: Math.round(target.distance),
        reason: target.reachable ? "covered" : "out_of_range",
      };
    });

    const covered = deviceStatuses.filter(status => status.reachable).length;
    const coveragePercent =
      deviceList.length === 0 ? 0 : Math.round((covered / deviceList.length) * 100);

    setStats({
      deviceStatuses,
      coveragePercent,
      activeWipers: best.targets.filter(target => target.deviceIdx !== null && target.reachable).length,
    });

    setWipers(prev =>
      prev.map((wiper, idx) => {
        const target = best.targets[idx];
        return {
          ...wiper,
          targetLength: target.targetLength,
          targetAngle: target.angle,
          isActive: target.deviceIdx !== null && target.reachable,
          assignedDevice: target.deviceIdx,
        };
      })
    );
  };

  // 모션이 켜진 동안 목표 각도/길이로 점진 이동
  useEffect(() => {
    if (!isPlaying) return undefined;
    const interval = setInterval(() => {
      setWipers(prev =>
        prev.map(wiper => {
          const lengthDiff = wiper.targetLength - wiper.currentLength;
          const angleDiff = wiper.targetAngle - wiper.currentAngle;
          let normalized = angleDiff;
          if (normalized > 180) normalized -= 360;
          if (normalized < -180) normalized += 360;
          return {
            ...wiper,
            currentLength: wiper.currentLength + lengthDiff * 0.1,
            currentAngle: wiper.currentAngle + normalized * 0.1,
          };
        })
      );
    }, 30);
    return () => clearInterval(interval);
  }, [isPlaying]);

  useEffect(() => {
    // 활성 기기 목록이 바뀔 때마다 목표 재계산
    updateWiperTargets(activeDevices);
  }, [activeDevices]);

  // 현재 상태를 캔버스에 그리기
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, PAD_WIDTH, PAD_HEIGHT);

    ctx.fillStyle = "#1e293b";
    ctx.fillRect(0, 0, PAD_WIDTH, PAD_HEIGHT);

    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1;
    for (let i = 0; i <= PAD_WIDTH; i += 50) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, PAD_HEIGHT);
      ctx.stroke();
    }
    for (let i = 0; i <= PAD_HEIGHT; i += 50) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(PAD_WIDTH, i);
      ctx.stroke();
    }

    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, PAD_HEIGHT - BOTTOM_MARGIN + 8, PAD_WIDTH, BOTTOM_MARGIN);
    ctx.fillRect(0, 0, PAD_WIDTH, TOP_MARGIN - 8);

    wipers.forEach(wiper => {
      ctx.fillStyle = wiper.color + "15";
      ctx.beginPath();
      ctx.arc(wiper.x, wiper.y, wiper.maxArmLength, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = wiper.color + "40";
      ctx.lineWidth = 2;
      ctx.stroke();
    });

    wipers.forEach(wiper => {
      const rad = (wiper.currentAngle * Math.PI) / 180;
      const endX = wiper.x + Math.cos(rad) * wiper.currentLength;
      const endY = wiper.y + Math.sin(rad) * wiper.currentLength;

      const sections = 3;
      for (let i = 0; i < sections; i += 1) {
        const startLen = (wiper.currentLength / sections) * i;
        const endLen = (wiper.currentLength / sections) * (i + 1);
        ctx.strokeStyle = wiper.isActive ? wiper.color : wiper.color + "60";
        ctx.lineWidth = 8 - i * 2;
        ctx.beginPath();
        ctx.moveTo(
          wiper.x + Math.cos(rad) * startLen,
          wiper.y + Math.sin(rad) * startLen
        );
        ctx.lineTo(
          wiper.x + Math.cos(rad) * endLen,
          wiper.y + Math.sin(rad) * endLen
        );
        ctx.stroke();
      }

      ctx.fillStyle = wiper.color;
      ctx.beginPath();
      ctx.arc(wiper.x, wiper.y, 12, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = wiper.isActive ? wiper.color : wiper.color + "80";
      ctx.beginPath();
      ctx.arc(endX, endY, COIL_RADIUS, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 3;
      ctx.stroke();

      if (wiper.isActive) {
        ctx.strokeStyle = wiper.color + "60";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(endX, endY, COIL_RADIUS + 10, 0, Math.PI * 2);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(endX, endY, COIL_RADIUS + 15, 0, Math.PI * 2);
        ctx.stroke();
      }
    });

    activeDevices.forEach((device, index) => {
      const status = stats.deviceStatuses[index];
      const assignedColor =
        status?.reachable && status.assignedWiper !== null
          ? WIPER_BASES[status.assignedWiper]?.color ?? "#94a3b8"
          : "#64748b";

      ctx.fillStyle = assignedColor;
      ctx.strokeStyle = "#e2e8f0";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(
        device.x - PHONE_WIDTH / 2,
        device.y - PHONE_HEIGHT / 2,
        PHONE_WIDTH,
        PHONE_HEIGHT,
        10
      );
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#0f172a";
      ctx.font = "bold 14px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`P${index + 1}`, device.x, device.y - PHONE_HEIGHT / 2 + 16);

      if (status?.reachable) {
        ctx.fillStyle = "#facc15";
        ctx.font = "bold 22px sans-serif";
        ctx.fillText("⚡", device.x, device.y + 5);
      } else if (status?.reason === "out_of_range") {
        ctx.fillStyle = "#f87171";
        ctx.font = "bold 20px sans-serif";
        ctx.fillText("×", device.x, device.y + 5);
      }
    });
  }, [wipers, activeDevices, stats]);

  // 캔버스에서 기기 클릭 시 드래그 시작
  const handleMouseDown = event => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const pointerX = event.clientX - rect.left;
    const pointerY = event.clientY - rect.top;

    for (let i = activeDevices.length - 1; i >= 0; i -= 1) {
      const device = activeDevices[i];
      const insideX = Math.abs(pointerX - device.x) <= PHONE_WIDTH / 2;
      const insideY = Math.abs(pointerY - device.y) <= PHONE_HEIGHT / 2;
      if (insideX && insideY) {
        setDraggingDeviceId(device.id);
        setDragOffset({ x: device.x - pointerX, y: device.y - pointerY });
        break;
      }
    }
  };

  // 포인터 이동 시 기기 위치 업데이트(패드 내부·타 기기와 간격 유지)
  const handleMouseMove = event => {
    if (draggingDeviceId === null) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const pointerX = event.clientX - rect.left;
    const pointerY = event.clientY - rect.top;

    const newX = clamp(
      pointerX + dragOffset.x,
      PHONE_WIDTH / 2,
      PAD_WIDTH - PHONE_WIDTH / 2
    );
    const newY = clamp(
      pointerY + dragOffset.y,
      PHONE_HEIGHT / 2,
      PAD_HEIGHT - PHONE_HEIGHT / 2 - 5
    );

    setDevices(prev => {
      const current = prev.find(device => device.id === draggingDeviceId);
      if (!current) return prev;

      const candidate = { ...current, x: newX, y: newY };
      const overlaps = prev.some(
        device => device.id !== draggingDeviceId && rectanglesOverlapWithGap(candidate, device)
      );
      if (overlaps) return prev;

      return prev.map(device =>
        device.id === draggingDeviceId ? { ...device, x: newX, y: newY } : device
      );
    });
  };

  // 드래그 종료 시 초기화
  const handleMouseUp = () => {
    setDraggingDeviceId(null);
    setDragOffset({ x: 0, y: 0 });
  };

  // 기기 전원 토글(끄면 위치 유지)
  const toggleDevice = deviceId => {
    setDevices(prev =>
      prev.map(device =>
        device.id === deviceId ? { ...device, enabled: !device.enabled } : device
      )
    );
    if (draggingDeviceId === deviceId) {
      setDraggingDeviceId(null);
      setDragOffset({ x: 0, y: 0 });
    }
  };

  // 초기 상태로 리셋
  const handleReset = () => {
    setDevices(buildDefaultDevices());
    setWipers(
      WIPER_BASES.map(base => ({
        ...base,
        currentLength: MIN_ARM_LENGTH,
        targetLength: MIN_ARM_LENGTH,
        currentAngle: base.angle,
        targetAngle: base.angle,
        isActive: false,
        assignedDevice: null,
      }))
    );
    setStats(emptyStats(DEFAULT_DEVICES.length));
    setDraggingDeviceId(null);
    setDragOffset({ x: 0, y: 0 });
  };

  // 현재 켜진 기기/커버된 기기 수
  const activeDeviceCount = activeDevices.length;
  const coveredDevices = stats.deviceStatuses.filter(status => status.reachable).length;

  return (
    <div className="min-h-screen w-full bg-slate-900 flex flex-col items-center justify-start py-8 px-4 sm:px-8">
      <div className="bg-slate-800 rounded-xl shadow-2xl p-6 max-w-4xl w-full">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">
              3-Wiper 무선충전 패드 시뮬레이터
            </h1>
            <p className="text-slate-400">
              세 대의 스마트폰을 드래그해서 충전 가능 여부를 확인하세요.
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 transition"
            >
              {isPlaying ? <Pause size={20} /> : <Play size={20} />}
              {isPlaying ? "일시정지" : "시작"}
            </button>
            <button
              onClick={handleReset}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg flex items-center gap-2 transition"
            >
              <RotateCcw size={20} />
              리셋
            </button>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          {devices.map(device => {
            const isEnabled = device.enabled;
            return (
              <button
                key={`device-toggle-${device.id}`}
                onClick={() => toggleDevice(device.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition ${
                  isEnabled
                    ? "bg-green-600 border-green-500 text-white hover:bg-green-500"
                    : "bg-slate-700 border-slate-600 text-slate-200 hover:bg-slate-600"
                }`}
              >
                <span className="text-sm font-semibold">기기 #{device.id + 1}</span>
                <span
                  className={`text-xs px-2 py-1 rounded-full ${
                    isEnabled ? "bg-white/20 text-white" : "bg-black/30 text-slate-200"
                  }`}
                >
                  {isEnabled ? "ON" : "OFF"}
                </span>
              </button>
            );
          })}
        </div>

        <div className="relative">
          <canvas
            ref={canvasRef}
            width={PAD_WIDTH}
            height={PAD_HEIGHT}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            className="border-4 border-slate-700 rounded-lg cursor-move"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          <div className="bg-slate-700 rounded-lg p-4">
            <div className="text-slate-400 text-sm mb-1">가동 와이퍼</div>
            <div className="text-2xl font-bold text-white">
              {stats.activeWipers} / {wipers.length}
            </div>
          </div>
          <div className="bg-slate-700 rounded-lg p-4">
            <div className="text-slate-400 text-sm mb-1">커버된 기기</div>
            <div className="text-2xl font-bold text-white">
              {coveredDevices} / {activeDeviceCount}
            </div>
          </div>
          <div className="bg-slate-700 rounded-lg p-4">
            <div className="text-slate-400 text-sm mb-1 flex items-center gap-2">
              <Zap size={16} className="text-green-400" />
              커버리지
            </div>
            <div className="text-2xl font-bold text-white">{stats.coveragePercent}%</div>
          </div>
        </div>

        <div className="mt-6 bg-slate-700 rounded-lg p-4">
          <h3 className="text-white font-semibold mb-3">기기 상태</h3>
          {activeDeviceCount === 0 ? (
            <div className="text-slate-300 text-sm">켜진 기기가 없습니다. 위 버튼에서 전원을 켜세요.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
              {stats.deviceStatuses.map((status, index) => {
                const device = activeDevices[index];
                if (!device) return null;
                const assignedColor =
                  status.assignedWiper !== null
                    ? WIPER_BASES[status.assignedWiper].color
                    : "#94a3b8";
                const distanceLabel =
                  status.assignedWiper !== null ? `${status.distance}mm` : "-";

                let label = "미할당";
                if (status.reachable && status.assignedWiper !== null) {
                  label = `와이퍼 #${status.assignedWiper + 1}`;
                } else if (status.reason === "out_of_range" && status.assignedWiper !== null) {
                  label = `범위 밖 (와이퍼 #${status.assignedWiper + 1})`;
                }

                return (
                  <div key={`device-${device.id}`} className="bg-slate-800 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: assignedColor }} />
                      <span className="text-slate-200 font-semibold">기기 #{device.id + 1}</span>
                    </div>
                    <div className="text-slate-300">{label}</div>
                    <div className="text-slate-400 text-xs mt-1">거리: {distanceLabel}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="mt-6 bg-slate-700 rounded-lg p-4">
          <h3 className="text-white font-semibold mb-3">설계 요약</h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="text-slate-300">
              <span className="text-slate-400">패드 크기:</span> {PAD_WIDTH} x {PAD_HEIGHT}mm
            </div>
            <div className="text-slate-300">
              <span className="text-slate-400">휴대폰 수:</span> {activeDeviceCount}대 / 총 {devices.length}대
            </div>
            <div className="text-slate-300">
              <span className="text-slate-400">최소 암 길이:</span> {MIN_ARM_LENGTH}mm
            </div>
            <div className="text-slate-300">
              <span className="text-slate-400">최대 암 길이:</span> {Math.round(MAX_COMPUTED_ARM_LENGTH)}mm
            </div>
            <div className="text-slate-300">
              <span className="text-slate-400">와이퍼 간격:</span> {MIN_WIPER_GAP}mm 이상
            </div>
            <div className="text-slate-300">
              <span className="text-slate-400">축 위치:</span> 좌하단 / 우하단 / 상단 중앙
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-blue-500" />
            <span className="text-slate-300 text-sm">와이퍼 #1</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-red-500" />
            <span className="text-slate-300 text-sm">와이퍼 #2</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-green-500" />
            <span className="text-slate-300 text-sm">와이퍼 #3</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WiperChargingSimulator;
