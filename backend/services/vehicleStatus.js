// "Réservé" n'est pas stocké : c'est un véhicule disponible couvert en ce moment par une réservation validée.
export const DISPLAY_STATUS_SQL = `CASE WHEN v.status = 'available' AND EXISTS (
         SELECT 1 FROM reservations r
          WHERE r.vehicle_id = v.id AND r.status = 'validated'
            AND r.start_at <= NOW() AND r.end_at > NOW())
       THEN 'reserved' ELSE v.status END`;
