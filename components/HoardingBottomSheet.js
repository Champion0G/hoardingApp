import React, { useCallback, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import BottomSheet from '@gorhom/bottom-sheet';

const HoardingBottomSheet = React.forwardRef((props, ref) => {
  const { hoarding } = props;
  
  // Variables
  const snapPoints = useMemo(() => ['25%', '50%'], []);

  // Callbacks
  const handleSheetChanges = useCallback((index) => {
    console.log('handleSheetChanges', index);
  }, []);

  return (
    <BottomSheet
      ref={ref}
      index={-1}
      snapPoints={snapPoints}
      onChange={handleSheetChanges}
      enablePanDownToClose
    >
      <View style={styles.contentContainer}>
        {hoarding ? (
          <>
            <Text style={styles.title}>{hoarding.title}</Text>
            <Text style={styles.description}>{hoarding.description}</Text>
            <View style={styles.detailsContainer}>
              <Text style={styles.detailText}>Size: {hoarding.size}</Text>
              <Text style={styles.detailText}>Price: {hoarding.price}</Text>
              <Text style={styles.detailText}>
                Location: {hoarding.latitude.toFixed(4)}, {hoarding.longitude.toFixed(4)}
              </Text>
            </View>
          </>
        ) : (
          <Text style={styles.placeholder}>Select a hoarding to view details</Text>
        )}
      </View>
    </BottomSheet>
  );
});

const styles = StyleSheet.create({
  contentContainer: {
    flex: 1,
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  description: {
    fontSize: 16,
    color: '#666',
    marginBottom: 16,
  },
  detailsContainer: {
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 8,
  },
  detailText: {
    fontSize: 14,
    marginBottom: 4,
  },
  placeholder: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
  },
});

export default HoardingBottomSheet; 