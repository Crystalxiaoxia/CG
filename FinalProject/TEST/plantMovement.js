// plantMovement.js
// 简单的海藻摆动动画：让整株海藻和子节点在 y 轴和 x 轴上做轻微周期性摇摆

export const PlantMovement = {
    init(grassMeshes) {
        // 将海藻根节点存到全局，方便在 main.js 中检查
        window.grassMeshes = grassMeshes || [];
        // 为每一棵海藻存一份随机相位，避免完全同步
        this._phases = (grassMeshes || []).map(() => Math.random() * Math.PI * 2);
    },

    update(time) {
        if (!window.grassMeshes) return;
        const amplitude = 0.18;   // 摆动幅度
        const speed = 0.8;        // 摆动速度

        window.grassMeshes.forEach((g, idx) => {
            const phase = this._phases ? (this._phases[idx] || 0) : 0;
            const sway = Math.sin(time * speed + phase) * amplitude;
            const sway2 = Math.cos(time * speed * 1.3 + phase) * amplitude * 0.6;

            // 整体轻微摆动
            g.rotation.y = sway;

            // 让子层级稍微更大一点摆动，模拟叶片在水里晃动
            g.traverse((n) => {
                if (!n.isMesh) return;
                const localSway = sway * 1.5;
                const localSway2 = sway2 * 1.2;
                n.rotation.x = localSway2;
                n.rotation.z = localSway;
            });
        });
    }
};


