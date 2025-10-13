import React, { useState, useEffect, useRef } from 'react';                                                                                                                   
import { Play, Pause, RotateCcw, Zap } from 'lucide-react';                                                                                                                   
                                                                                                                                                                              
const PAD_WIDTH = 500;                                                                                                                                                        
const PAD_HEIGHT = 400;                                                                                                                                                       
const COIL_RADIUS = 25;                                                                                                                                                       
const MIN_ARM_LENGTH = 50;                                                                                                                                                    
const PHONE_WIDTH = 60;                                                                                                                                                       
const PHONE_HEIGHT = 90;                                                                                                                                                      
const PHONE_COUNT = 3;                                                                                                                                                        
const BOTTOM_MARGIN = 18;                                                                                                                                                     
const MIN_WIPER_GAP = COIL_RADIUS * 2;                                                                                                                                   
                                                                                                                                                                              
const padCorners = [                                                                                                                                                          
  { x: 0, y: 0 },                                                                                                                                                             
  { x: PAD_WIDTH, y: 0 },                                                                                                                                                     
  { x: 0, y: PAD_HEIGHT },                                                                                                                                                    
  { x: PAD_WIDTH, y: PAD_HEIGHT },                                                                                                                                            
];                                                                                                                                                                            
                                                                                                                                                                              
const clamp = (value, min, max) => Math.min(Math.max(value, min), max);                                                                                                       
const deg = radians => (radians * 180) / Math.PI;                                                                                                                             
const normalizeAngle = angle => {                                                                                                                                             
  let value = angle % 360;                                                                                                                                                    
  if (value < 0) value += 360;                                                                                                                                                
  return value;                                                                                                                                                               
};                                                                                                                                                                            
                                                                                                                                                                              
const calculateMaxReach = base =>                                                                                                                                             
  Math.max(                                                                                                                                                                   
    ...padCorners.map(corner => Math.hypot(corner.x - base.x, corner.y - base.y))                                                                                             
  );                                                                                                                                                                          
                                                                                                                                                                              
const RAW_WIPER_BASES = [                                                                                                                                                     
  { x: PAD_WIDTH * 0.15, y: PAD_HEIGHT - BOTTOM_MARGIN, angle: 270, color: '#3b82f6' },                                                                                       
  { x: PAD_WIDTH * 0.5, y: PAD_HEIGHT - BOTTOM_MARGIN, angle: 270, color: '#ef4444' },                                                                                        
  { x: PAD_WIDTH * 0.85, y: PAD_HEIGHT - BOTTOM_MARGIN, angle: 270, color: '#10b981' },                                                                                       
];                                                                                                                                                                            
                                                                                                                                                                              
const WIPER_BASES = RAW_WIPER_BASES.map(base => ({                                                                                                                            
  ...base,                                                                                                                                                                    
  maxArmLength: calculateMaxReach(base),                                                                                                                                      
}));                                                                                                                                                                          
                                                                                                                                                                              
const MAX_COMPUTED_ARM_LENGTH = Math.max(...WIPER_BASES.map(base => base.maxArmLength));                                                                                      
                                                                                                                                                                              
const DEFAULT_DEVICES = [                                                                                                                                                     
  { x: PAD_WIDTH * 0.35, y: PAD_HEIGHT * 0.38 },                                                                                                                              
  { x: PAD_WIDTH * 0.6, y: PAD_HEIGHT * 0.35 },                                                                                                                               
  { x: PAD_WIDTH * 0.5, y: PAD_HEIGHT * 0.62 },                                                                                                                               
];                                                                                                                                                                            
                                                                                                                                                                              
const endpoint = (base, length, angle) => ({                                                                                                                                  
  x: base.x + Math.cos((angle * Math.PI) / 180) * length,                                                                                                                     
  y: base.y + Math.sin((angle * Math.PI) / 180) * length,                                                                                                                     
});                                                                                                                                                                           
                                                                                                                                                                              
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
                                                                                                                                                                              
const segmentDistance = (a1, a2, b1, b2) => {                                                                                                                                 
  if (segmentsIntersect(a1, a2, b1, b2)) return 0;                                                                                                                            
  return Math.min(                                                                                                                                                            
    distancePointToSegment(a1, b1, b2),                                                                                                                                       
    distancePointToSegment(a2, b1, b2),                                                                                                                                       
    distancePointToSegment(b1, a1, a2),                                                                                                                                       
    distancePointToSegment(b2, a1, a2)                                                                                                                                        
  );                                                                                                                                                                          
};                                                                                                                                                                            
                                                                                                                                                                              
const emptyStats = count => ({                                                                                                                                                
  deviceStatuses: Array.from({ length: count }, () => ({                                                                                                                      
    reachable: false,                                                                                                                                                         
    assignedWiper: null,                                                                                                                                                      
    distance: 0,                                                                                                                                                              
    reason: 'unassigned',                                                                                                                                                     
  })),                                                                                                                                                                        
  coveragePercent: 0,                                                                                                                                                         
  activeWipers: 0,                                                                                                                                                            
});                                                                                                                                                                           
                                                                                                                                                                              
const WiperChargingSimulator = () => {                                                                                                                                        
  const canvasRef = useRef(null);                                                                                                                                             
  const [isPlaying, setIsPlaying] = useState(false);                                                                                                                          
  const [devices, setDevices] = useState(() => DEFAULT_DEVICES.map(device => ({ ...device })));                                                                               
  const [draggingDevice, setDraggingDevice] = useState(null);                                                                                                                 
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });                                                                                                               
  const [stats, setStats] = useState(() => emptyStats(PHONE_COUNT));                                                                                                          
                                                                                                                                                                              
  const [wipers, setWipers] = useState(() =>                                                                                                                                  
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
                                                                                                                                                                           
/*   const updateWiperTargets = () => {                                                                                                                                          
    const assignments = [];                                                                                                                                                   
    const usedDevices = new Set();                                                                                                                                            
                                                                                                                                                                              
    const buildAssignments = (wiperIdx, current) => {                                                                                                                         
      if (wiperIdx === WIPER_BASES.length) {                                                                                                                                  
        assignments.push([...current]);                                                                                                                                       
        return;                                                                                                                                                               
      }                                                                                                                                                                       
                                                                                                                                                                              
      current.push(null);                                                                                                                                                     
      buildAssignments(wiperIdx + 1, current);                                                                                                                                
      current.pop();                                                                                                                                                          
                                                                                                                                                                              
      for (let deviceIdx = 0; deviceIdx < devices.length; deviceIdx += 1) {                                                                                                   
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
        const device = devices[deviceIdx];                                                                                                                                    
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
          if (segmentDistance(baseA, endA, baseB, endB) < MIN_WIPER_GAP) {                                                                                                    
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
                                                                                                                                                                              
      if (                                                                                                                                                                    
        !best ||                                                                                                                                                              
        reachableCount > best.reachableCount ||                                                                                                                               
        (reachableCount === best.reachableCount && assignedCount > best.assignedCount) ||                                                                                     
        (reachableCount === best.reachableCount &&                                                                                                                            
          assignedCount === best.assignedCount &&                                                                                                                             
          distanceSum < best.distanceSum)                                                                                                                                     
      ) {                                                                                                                                                                     
        best = { targets, reachableCount, assignedCount, distanceSum };                                                                                                       
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
        distanceSum: 0,                                                                                                                                                       
      };                                                                                                                                                                      
    }                                                                                                                                                                         
                                                                                                                                                                              
    const deviceStatuses = devices.map(() => ({                                                                                                                               
      reachable: false,                                                                                                                                                       
      assignedWiper: null,                                                                                                                                                    
      distance: 0,                                                                                                                                                            
      reason: 'unassigned',                                                                                                                                                   
    }));                                                                                                                                                                      
                                                                                                                                                                              
    best.targets.forEach(target => {                                                                                                                                          
      if (target.deviceIdx === null) return;                                                                                                                                  
      deviceStatuses[target.deviceIdx] = {                                                                                                                                    
        reachable: target.reachable,                                                                                                                                          
        assignedWiper: target.wiperIdx,                                                                                                                                       
        distance: Math.round(target.distance),                                                                                                                                
        reason: target.reachable ? 'covered' : 'out_of_range',                                                                                                                
      };                                                                                                                                                                      
    });                                                                                                                                                                       
                                                                                                                                                                              
    const covered = deviceStatuses.filter(status => status.reachable).length;                                                                                                 
                                                                                                                                                                              
    setStats({                                                                                                                                                                
      deviceStatuses,                                                                                                                                                         
      coveragePercent: Math.round((covered / devices.length) * 100),                                                                                                          
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
  };   */      

 
    const updateWiperTargets = () => {
    // ---------- 1) 정렬(좌->우) ----------
    const wSorted = [...WIPER_BASES.keys()].sort((a, b) => WIPER_BASES[a].x - WIPER_BASES[b].x);
    const dSorted = [...devices.keys()].sort((a, b) => devices[a].x - devices[b].x);

    const N = wSorted.length;
    const M = dSorted.length;

    // ---------- 2) 베이스-디바이스 쌍의 기하정보/도달성 미리 계산 ----------
    const pairInfo = Array.from({ length: N }, () => Array(M).fill(null));
    for (let i = 0; i < N; i += 1) {
      const b = WIPER_BASES[wSorted[i]];
      for (let j = 0; j < M; j += 1) {
        const d = devices[dSorted[j]];
        const dx = d.x - b.x;
        const dy = d.y - b.y;
        const dist = Math.hypot(dx, dy);
        const angle = normalizeAngle(deg(Math.atan2(dy, dx)));
        pairInfo[i][j] = {
          reachable: dist <= b.maxArmLength,
          dist,
          angle,
        };
      }
    }

    // ---------- 3) DP: 최대 커버(1순위) + 총거리 최소(2순위) ----------
    // DP[i][j] = 첫 i개 와이퍼, 첫 j개 디바이스로 얻을 수 있는 최적 (cover, cost)
    const DP = Array.from({ length: N + 1 }, () => Array(M + 1).fill(null));
    const PREV = Array.from({ length: N + 1 }, () => Array(M + 1).fill(null));
    DP[0][0] = { cover: 0, cost: 0 };

    const better = (a, b) => {
      if (!a) return b;
      if (!b) return a;
      if (a.cover !== b.cover) return a.cover > b.cover ? a : b;
      return a.cost <= b.cost ? a : b;
    };

    for (let i = 0; i <= N; i += 1) {
      for (let j = 0; j <= M; j += 1) {
        if (!DP[i][j]) continue;

        // skip device j+1
        if (j < M) {
          const alt = { cover: DP[i][j].cover, cost: DP[i][j].cost };
          if (better(DP[i][j + 1], alt) === alt) {
            DP[i][j + 1] = alt;
            PREV[i][j + 1] = { pi: i, pj: j, act: 'skipD' };
          }
        }

        // skip wiper i+1
        if (i < N) {
          const alt = { cover: DP[i][j].cover, cost: DP[i][j].cost };
          if (better(DP[i + 1][j], alt) === alt) {
            DP[i + 1][j] = alt;
            PREV[i + 1][j] = { pi: i, pj: j, act: 'skipW' };
          }
        }

        // match i+1 with j+1 (순서보존)
        if (i < N && j < M && pairInfo[i][j].reachable) {
          const alt = {
            cover: DP[i][j].cover + 1,
            cost: DP[i][j].cost + pairInfo[i][j].dist,
          };
          if (better(DP[i + 1][j + 1], alt) === alt) {
            DP[i + 1][j + 1] = alt;
            PREV[i + 1][j + 1] = { pi: i, pj: j, act: 'match' };
          }
        }
      }
    }

    // ---------- 4) 역추적: 순서보존 매칭 복원 ----------
    const matchIJ = Array(N).fill(null); // matchIJ[i] = j (정렬된 인덱스 기준)
    let i = N;
    let j = M;
    while (i > 0 || j > 0) {
      const p = PREV[i][j];
      if (!p) break;
      if (p.act === 'match') matchIJ[i - 1] = j - 1;
      i = p.pi;
      j = p.pj;
    }

    // ---------- 5) 원래 인덱스로 복구 + 타깃 구성(초안) ----------
    let targets = Array.from({ length: N }, (_, ii) => {
      const wIdx = wSorted[ii];
      const base = WIPER_BASES[wIdx];
      const jj = matchIJ[ii];
      if (jj == null) {
        return {
          wiperIdx: wIdx,
          deviceIdx: null,
          angle: base.angle,
          targetLength: MIN_ARM_LENGTH,
          reachable: false,
          distance: 0,
        };
      }
      const dIdx = dSorted[jj];
      const d = devices[dIdx];
      const { dist, angle } = pairInfo[ii][jj];
      return {
        wiperIdx: wIdx,
        deviceIdx: dIdx,
        angle,
        targetLength: clamp(dist, MIN_ARM_LENGTH, base.maxArmLength),
        reachable: true,
        distance: dist,
      };
    });

    // ---------- 6) 인접쌍 최소 간격 보정(로컬 스왑/해제로 충돌 제거) ----------
    // 순서보존 매칭은 교차를 원천 차단하지만, 선분 간 최소 간격(MIN_WIPER_GAP)을 보수적으로 맞춘다.
    const enforceGap = () => {
      let changed = false;
      for (let k = 1; k < targets.length; k += 1) {
        const A = targets[k - 1];
        const B = targets[k];
        if (!(A.reachable && B.reachable)) continue;

        const baseA = WIPER_BASES[A.wiperIdx];
        const baseB = WIPER_BASES[B.wiperIdx];
        const endA = endpoint(baseA, A.targetLength, A.angle);
        const endB = endpoint(baseB, B.targetLength, B.angle);
        const gap = segmentDistance(baseA, endA, baseB, endB);

        if (gap >= MIN_WIPER_GAP) continue; // 충분히 떨어져 있음

        // 6-1) 인접 디바이스가 서로 교환 가능하면 스왑 시도 (여전히 순서보존)
        const ii = wSorted.indexOf(A.wiperIdx);
        const jj = wSorted.indexOf(B.wiperIdx);
        const iJA = matchIJ[ii];
        const iJB = matchIJ[jj];

        // swap 가능한 인접 디바이스 쌍이라면 시험 적용
        if (iJA != null && iJB != null && Math.abs(iJA - iJB) === 1) {
          const aNew = pairInfo[ii][iJB];
          const bNew = pairInfo[jj][iJA];
          if (aNew?.reachable && bNew?.reachable) {
            // 스왑 후 gap 재검사
            const tA = {
              ...A,
              deviceIdx: dSorted[iJB],
              angle: aNew.angle,
              targetLength: clamp(aNew.dist, MIN_ARM_LENGTH, baseA.maxArmLength),
              distance: aNew.dist,
            };
            const tB = {
              ...B,
              deviceIdx: dSorted[iJA],
              angle: bNew.angle,
              targetLength: clamp(bNew.dist, MIN_ARM_LENGTH, baseB.maxArmLength),
              distance: bNew.dist,
            };
            const endA2 = endpoint(baseA, tA.targetLength, tA.angle);
            const endB2 = endpoint(baseB, tB.targetLength, tB.angle);
            const gap2 = segmentDistance(baseA, endA2, baseB, endB2);
            if (gap2 >= MIN_WIPER_GAP) {
              // 스왑 채택
              targets[k - 1] = tA;
              targets[k] = tB;
              matchIJ[ii] = iJB;
              matchIJ[jj] = iJA;
              changed = true;
              continue;
            }
          }
        }

        // 6-2) 스왑이 안 되면, 더 먼(코스트 큰) 쪽을 해제하여 충돌 제거
        // (모든 스마트폰을 "가능하면" 연결: DP가 이미 최대 커버를 만들었고
        // gap 때문에 불가할 때만 마지막 수단으로 1개 해제)
        if (A.distance >= B.distance) {
          targets[k - 1] = {
            ...A,
            deviceIdx: null,
            reachable: false,
            targetLength: MIN_ARM_LENGTH,
            distance: 0,
          };
        } else {
          targets[k] = {
            ...B,
            deviceIdx: null,
            reachable: false,
            targetLength: MIN_ARM_LENGTH,
            distance: 0,
          };
        }
        changed = true;
      }
      return changed;
    };

    // 여러 쌍에서 연쇄적으로 근접할 수 있으므로 2~3회 반복 보정
    for (let t = 0; t < 3; t += 1) {
      if (!enforceGap()) break;
    }

    // ---------- 7) 원래 wiper 순서로 되돌리기 ----------
    const targetsByOrig = Array(N).fill(null);
    for (let ii = 0; ii < N; ii += 1) {
      const pos = wSorted[ii];
      const t = targets[ii];
      // 정렬에서 빠진 와이퍼(없음)는 방어적으로 idle
      const base = WIPER_BASES[pos];
      targetsByOrig[pos] = t
        ? t
        : {
            wiperIdx: pos,
            deviceIdx: null,
            angle: base.angle,
            targetLength: MIN_ARM_LENGTH,
            reachable: false,
            distance: 0,
          };
    }

    // ---------- 8) 통계 및 상태 반영(기존 로직 유지) ----------
    const deviceStatuses = devices.map(() => ({
      reachable: false,
      assignedWiper: null,
      distance: 0,
      reason: 'unassigned',
    }));

    targetsByOrig.forEach((target) => {
      if (target.deviceIdx === null) return;
      deviceStatuses[target.deviceIdx] = {
        reachable: target.reachable,
        assignedWiper: target.wiperIdx,
        distance: Math.round(target.distance),
        reason: target.reachable ? 'covered' : 'out_of_range',
      };
    });

    const covered = deviceStatuses.filter((s) => s.reachable).length;

    setStats({
      deviceStatuses,
      coveragePercent: Math.round((covered / devices.length) * 100),
      activeWipers: targetsByOrig.filter((t) => t.deviceIdx !== null && t.reachable).length,
    });

    setWipers((prev) =>
      prev.map((wiper, idx) => {
        const t = targetsByOrig[idx];
        return {
          ...wiper,
          targetLength: t.targetLength,
          targetAngle: t.angle,
          isActive: t.deviceIdx !== null && t.reachable,
          assignedDevice: t.deviceIdx,
        };
      })
    );
  };

                                                                                                                                                                              
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
    updateWiperTargets();                                                                                                                                                     
  }, [devices]);                                                                                                                                                              
                                                                                                                                                                              
  useEffect(() => {                                                                                                                                                           
    const canvas = canvasRef.current;                                                                                                                                         
    if (!canvas) return;                                                                                                                                                      
    const ctx = canvas.getContext('2d');                                                                                                                                      
    ctx.clearRect(0, 0, PAD_WIDTH, PAD_HEIGHT);                                                                                                                               
                                                                                                                                                                              
    ctx.fillStyle = '#1e293b';                                                                                                                                                
    ctx.fillRect(0, 0, PAD_WIDTH, PAD_HEIGHT);                                                                                                                                
                                                                                                                                                                              
    ctx.strokeStyle = '#334155';                                                                                                                                              
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
                                                                                                                                                                              
    ctx.fillStyle = '#0f172a';                                                                                                                                                
    ctx.fillRect(0, PAD_HEIGHT - BOTTOM_MARGIN + 8, PAD_WIDTH, BOTTOM_MARGIN);                                                                                                
                                                                                                                                                                              
    wipers.forEach(wiper => {                                                                                                                                                 
      ctx.fillStyle = wiper.color + '15';                                                                                                                                     
      ctx.beginPath();                                                                                                                                                        
      ctx.arc(wiper.x, wiper.y, wiper.maxArmLength, 0, Math.PI * 2);                                                                                                          
      ctx.fill();                                                                                                                                                             
                                                                                                                                                                              
      ctx.strokeStyle = wiper.color + '40';                                                                                                                                   
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
        ctx.strokeStyle = wiper.isActive ? wiper.color : wiper.color + '60';                                                                                                  
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
                                                                                                                                                                              
      ctx.strokeStyle = '#ffffff';                                                                                                                                            
      ctx.lineWidth = 2;                                                                                                                                                      
      ctx.stroke();                                                                                                                                                           
                                                                                                                                                                              
      ctx.fillStyle = wiper.isActive ? wiper.color : wiper.color + '80';                                                                                                      
      ctx.beginPath();                                                                                                                                                        
      ctx.arc(endX, endY, COIL_RADIUS, 0, Math.PI * 2);                                                                                                                       
      ctx.fill();                                                                                                                                                             
                                                                                                                                                                              
      ctx.strokeStyle = '#ffffff';                                                                                                                                            
      ctx.lineWidth = 3;                                                                                                                                                      
      ctx.stroke();                                                                                                                                                           
                                                                                                                                                                              
      if (wiper.isActive) {                                                                                                                                                   
        ctx.strokeStyle = wiper.color + '60';                                                                                                                                 
        ctx.lineWidth = 2;                                                                                                                                                    
        ctx.beginPath();                                                                                                                                                      
        ctx.arc(endX, endY, COIL_RADIUS + 10, 0, Math.PI * 2);                                                                                                                
        ctx.stroke();                                                                                                                                                         
                                                                                                                                                                              
        ctx.beginPath();                                                                                                                                                      
        ctx.arc(endX, endY, COIL_RADIUS + 15, 0, Math.PI * 2);                                                                                                                
        ctx.stroke();                                                                                                                                                         
      }                                                                                                                                                                       
    });                                                                                                                                                                       
                                                                                                                                                                              
    devices.forEach((device, index) => {                                                                                                                                      
      const status = stats.deviceStatuses[index];                                                                                                                             
      const assignedColor =                                                                                                                                                   
        status?.reachable && status.assignedWiper !== null                                                                                                                    
          ? WIPER_BASES[status.assignedWiper]?.color ?? '#94a3b8'                                                                                                             
          : '#64748b';                                                                                                                                                        
                                                                                                                                                                              
      ctx.fillStyle = assignedColor;                                                                                                                                          
      ctx.strokeStyle = '#e2e8f0';                                                                                                                                            
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
                                                                                                                                                                              
      ctx.fillStyle = '#0f172a';                                                                                                                                              
      ctx.font = 'bold 14px sans-serif';                                                                                                                                      
      ctx.textAlign = 'center';                                                                                                                                               
      ctx.textBaseline = 'middle';                                                                                                                                            
      ctx.fillText(`P${index + 1}`, device.x, device.y - PHONE_HEIGHT / 2 + 16);                                                                                              
                                                                                                                                                                              
      if (status?.reachable) {                                                                                                                                                
        ctx.fillStyle = '#facc15';                                                                                                                                            
        ctx.font = 'bold 22px sans-serif';                                                                                                                                    
        ctx.fillText('⚡', device.x, device.y + 5);                                                                                                                           
      } else if (status?.reason === 'out_of_range') {                                                                                                                         
        ctx.fillStyle = '#f87171';                                                                                                                                            
        ctx.font = 'bold 20px sans-serif';                                                                                                                                    
        ctx.fillText('×', device.x, device.y + 5);                                                                                                                            
      }                                                                                                                                                                       
    });                                                                                                                                                                       
  }, [wipers, devices, stats]);                                                                                                                                               
                                                                                                                                                                              
  const handleMouseDown = event => {                                                                                                                                          
    const canvas = canvasRef.current;                                                                                                                                         
    if (!canvas) return;                                                                                                                                                      
    const rect = canvas.getBoundingClientRect();                                                                                                                              
    const pointerX = event.clientX - rect.left;                                                                                                                               
    const pointerY = event.clientY - rect.top;                                                                                                                                
                                                                                                                                                                              
    for (let i = devices.length - 1; i >= 0; i -= 1) {                                                                                                                        
      const device = devices[i];                                                                                                                                              
      const insideX = Math.abs(pointerX - device.x) <= PHONE_WIDTH / 2;                                                                                                       
      const insideY = Math.abs(pointerY - device.y) <= PHONE_HEIGHT / 2;                                                                                                      
      if (insideX && insideY) {                                                                                                                                               
        setDraggingDevice(i);                                                                                                                                                 
        setDragOffset({ x: device.x - pointerX, y: device.y - pointerY });                                                                                                    
        break;                                                                                                                                                                
      }                                                                                                                                                                       
    }                                                                                                                                                                         
  };                                                                                                                                                                          
                                                                                                                                                                              
  const handleMouseMove = event => {                                                                                                                                          
    if (draggingDevice === null) return;                                                                                                                                      
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
                                                                                                                                                                              
    setDevices(prev =>                                                                                                                                                        
      prev.map((device, idx) =>                                                                                                                                               
        idx === draggingDevice ? { ...device, x: newX, y: newY } : device                                                                                                     
      )                                                                                                                                                                       
    );                                                                                                                                                                        
  };                                                                                                                                                                          
                                                                                                                                                                              
  const handleMouseUp = () => {                                                                                                                                               
    setDraggingDevice(null);                                                                                                                                                  
    setDragOffset({ x: 0, y: 0 });                                                                                                                                            
  };                                                                                                                                                                          
                                                                                                                                                                              
  const handleReset = () => {                                                                                                                                                 
    setDevices(DEFAULT_DEVICES.map(device => ({ ...device })));                                                                                                               
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
    setStats(emptyStats(PHONE_COUNT));                                                                                                                                        
    setDraggingDevice(null);                                                                                                                                                  
    setDragOffset({ x: 0, y: 0 });                                                                                                                                            
  };                                                                                                                                                                          
                                                                                                                                                                              
  const coveredDevices = stats.deviceStatuses.filter(status => status.reachable).length;                                                                                      
                                                                                                                                                                              
  return (                                                                                                                                                                    
    <div className='w-full h-screen bg-slate-900 flex flex-col items-center justify-center p-8'>                                                                              
      <div className='bg-slate-800 rounded-xl shadow-2xl p-6 max-w-4xl w-full'>                                                                                               
        <div className='flex items-center justify-between mb-6'>                                                                                                              
          <div>                                                                                                                                                               
            <h1 className='text-3xl font-bold text-white mb-2'>                                                                                                               
              3-Wiper 무선충전 패드 시뮬레이터                                                                                                                                
            </h1>                                                                                                                                                             
            <p className='text-slate-400'>                                                                                                                                    
              세 대의 스마트폰을 드래그해서 충전 가능 여부를 확인하세요.                                                                                                      
            </p>                                                                                                                                                              
          </div>                                                                                                                                                              
          <div className='flex gap-3'>                                                                                                                                        
            <button                                                                                                                                                           
              onClick={() => setIsPlaying(!isPlaying)}                                                                                                                        
              className='px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 transition'                                                    
            >                                                                                                                                                                 
              {isPlaying ? <Pause size={20} /> : <Play size={20} />}                                                                                                          
              {isPlaying ? '일시정지' : '시작'}                                                                                                                               
            </button>                                                                                                                                                         
            <button                                                                                                                                                           
              onClick={handleReset}                                                                                                                                           
              className='px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg flex items-center gap-2 transition'                                                  
            >                                                                                                                                                                 
              <RotateCcw size={20} />                                                                                                                                         
              리셋                                                                                                                                                            
            </button>                                                                                                                                                         
          </div>                                                                                                                                                              
        </div>                                                                                                                                                                
                                                                                                                                                                              
        <div className='relative'>                                                                                                                                            
          <canvas                                                                                                                                                             
            ref={canvasRef}                                                                                                                                                   
            width={PAD_WIDTH}                                                                                                                                                 
            height={PAD_HEIGHT}                                                                                                                                               
            onMouseDown={handleMouseDown}                                                                                                                                     
            onMouseMove={handleMouseMove}                                                                                                                                     
            onMouseUp={handleMouseUp}                                                                                                                                         
            onMouseLeave={handleMouseUp}                                                                                                                                      
            className='border-4 border-slate-700 rounded-lg cursor-move'                                                                                                      
          />                                                                                                                                                                  
        </div>                                                                                                                                                                
                                                                                                                                                                              
        <div className='grid grid-cols-1 md:grid-cols-3 gap-4 mt-6'>                                                                                                          
          <div className='bg-slate-700 rounded-lg p-4'>                                                                                                                       
            <div className='text-slate-400 text-sm mb-1'>가동 와이퍼</div>                                                                                                    
            <div className='text-2xl font-bold text-white'>                                                                                                                   
              {stats.activeWipers} / {wipers.length}                                                                                                                          
            </div>                                                                                                                                                            
          </div>                                                                                                                                                              
          <div className='bg-slate-700 rounded-lg p-4'>                                                                                                                       
            <div className='text-slate-400 text-sm mb-1'>커버된 기기</div>                                                                                                    
            <div className='text-2xl font-bold text-white'>                                                                                                                   
              {coveredDevices} / {devices.length}                                                                                                                             
            </div>                                                                                                                                                            
          </div>                                                                                                                                                              
          <div className='bg-slate-700 rounded-lg p-4'>                                                                                                                       
            <div className='text-slate-400 text-sm mb-1 flex items-center gap-2'>                                                                                             
              <Zap size={16} className='text-green-400' />                                                                                                                    
              커버리지                                                                                                                                                        
            </div>                                                                                                                                                            
            <div className='text-2xl font-bold text-white'>{stats.coveragePercent}%</div>                                                                                     
          </div>                                                                                                                                                              
        </div>                                                                                                                                                                
                                                                                                                                                                              
        <div className='mt-6 bg-slate-700 rounded-lg p-4'>                                                                                                                    
          <h3 className='text-white font-semibold mb-3'>기기 상태</h3>                                                                                                        
          <div className='grid grid-cols-1 md:grid-cols-3 gap-3 text-sm'>                                                                                                     
            {stats.deviceStatuses.map((status, index) => {                                                                                                                    
              const assignedColor =                                                                                                                                           
                status.assignedWiper !== null                                                                                                                                 
                  ? WIPER_BASES[status.assignedWiper].color                                                                                                                   
                  : '#94a3b8';                                                                                                                                                
              const distanceLabel =                                                                                                                                           
                status.assignedWiper !== null ? `${status.distance}mm` : '-';                                                                                                 
                                                                                                                                                                              
              let label = '미할당';                                                                                                                                           
              if (status.reachable && status.assignedWiper !== null) {                                                                                                        
                label = `와이퍼 #${status.assignedWiper + 1}`;                                                                                                                
              } else if (status.reason === 'out_of_range' && status.assignedWiper !== null) {                                                                                 
                label = `범위 밖 (와이퍼 #${status.assignedWiper + 1})`;                                                                                                      
              }                                                                                                                                                               
                                                                                                                                                                              
              return (                                                                                                                                                        
                <div key={`device-${index}`} className='bg-slate-800 rounded-lg p-3'>                                                                                         
                  <div className='flex items-center gap-2 mb-2'>                                                                                                              
                    <div className='w-3 h-3 rounded-full' style={{ backgroundColor: assignedColor }} />                                                                       
                    <span className='text-slate-200 font-semibold'>기기 #{index + 1}</span>                                                                                   
                  </div>                                                                                                                                                      
                  <div className='text-slate-300'>{label}</div>                                                                                                               
                  <div className='text-slate-400 text-xs mt-1'>거리: {distanceLabel}</div>                                                                                    
                </div>                                                                                                                                                        
              );                                                                                                                                                              
            })}                                                                                                                                                               
          </div>                                                                                                                                                              
        </div>                                                                                                                                                                
                                                                                                                                                                              
        <div className='mt-6 bg-slate-700 rounded-lg p-4'>                                                                                                                    
          <h3 className='text-white font-semibold mb-3'>설계 요약</h3>                                                                                                        
          <div className='grid grid-cols-2 gap-3 text-sm'>                                                                                                                    
            <div className='text-slate-300'>                                                                                                                                  
              <span className='text-slate-400'>패드 크기:</span> {PAD_WIDTH} x {PAD_HEIGHT}mm                                                                                 
            </div>                                                                                                                                                            
            <div className='text-slate-300'>                                                                                                                                  
              <span className='text-slate-400'>휴대폰 수:</span> {devices.length}대                                                                                           
            </div>                                                                                                                                                            
            <div className='text-slate-300'>                                                                                                                                  
              <span className='text-slate-400'>최소 암 길이:</span> {MIN_ARM_LENGTH}mm                                                                                        
            </div>                                                                                                                                                            
            <div className='text-slate-300'>                                                                                                                                  
              <span className='text-slate-400'>최대 암 길이:</span> {Math.round(MAX_COMPUTED_ARM_LENGTH)}mm                                                                   
            </div>                                                                                                                                                            
            <div className='text-slate-300'>                                                                                                                                  
              <span className='text-slate-400'>와이퍼 간격:</span> {MIN_WIPER_GAP}mm 이상                                                                                     
            </div>                                                                                                                                                            
            <div className='text-slate-300'>                                                                                                                                  
              <span className='text-slate-400'>축 위치:</span> 하단 균등 배치                                                                                                 
            </div>                                                                                                                                                            
          </div>                                                                                                                                                              
        </div>                                                                                                                                                                
                                                                                                                                                                              
        <div className='mt-4 flex flex-wrap gap-4'>                                                                                                                           
          <div className='flex items-center gap-2'>                                                                                                                           
            <div className='w-4 h-4 rounded-full bg-blue-500' />                                                                                                              
            <span className='text-slate-300 text-sm'>와이퍼 #1</span>                                                                                                         
          </div>                                                                                                                                                              
          <div className='flex items-center gap-2'>                                                                                                                           
            <div className='w-4 h-4 rounded-full bg-red-500' />                                                                                                               
            <span className='text-slate-300 text-sm'>와이퍼 #2</span>                                                                                                         
          </div>                                                                                                                                                              
          <div className='flex items-center gap-2'>                                                                                                                           
            <div className='w-4 h-4 rounded-full bg-green-500' />                                                                                                             
            <span className='text-slate-300 text-sm'>와이퍼 #3</span>                                                                                                         
          </div>                                                                                                                                                              
        </div>                                                                                                                                                                
      </div>                                                                                                                                                                  
    </div>                                                                                                                                                                    
  );                                                                                                                                                                          
};                                                                                                                                                                            
                                                                                                                                                                              
export default WiperChargingSimulator; 